import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSellerIdentity } from "./seller";
import { confirmManualOrder } from "./confirm-manual";
import { ensureOrderLicense } from "./issue";
import { createManualExclusiveLicense } from "./manual-license";
import { renderContractHtml } from "./preview";
import { toOrderRow } from "@/lib/orders/order-row";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";

const enabled = process.env.LICENSE_INTEGRATION_TEST === "1";

test("license integration: manual sale, payment webhook, retries and frozen PDF", { skip: !enabled, timeout: 120_000 }, async (t) => {
  assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith("/hamloprod_license_test"), "Integration tests require the isolated hamloprod_license_test database");
  const storage = new ContaboS3Storage(getS3Config());
  const keys = new Set<string>();
  const beatIds: string[] = [];
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "license-integration-only";
  t.after(async () => {
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    const orders = await prisma.order.findMany({ where: { beatId: { in: beatIds } }, select: { contractPdfKey: true } });
    for (const order of orders) if (order.contractPdfKey) keys.add(order.contractPdfKey);
    for (const key of keys) await storage.deleteObject({ visibility: "private", key });
    await prisma.order.deleteMany({ where: { beatId: { in: beatIds } } });
    await prisma.beat.deleteMany({ where: { id: { in: beatIds } } });
    await prisma.$disconnect();
  });
  const makeBeat = async () => {
    const suffix = randomUUID();
    const beat = await prisma.beat.create({ data: { slug: `license-test-${suffix}`, caseNumber: `TEST-${suffix.slice(0, 8)}`, title: "Тестовый бит / Test Beat", genre: "trap", priceUsd: 100, priceRub: 2500, status: "available" } });
    beatIds.push(beat.id);
    return beat;
  };
  const buyer = { buyerName: "Тестовый Покупатель", buyerEmail: "license-test@example.invalid", buyerCountry: "Finland", buyerCity: "Turku", buyerStageName: "Test Artist", buyerPhone: "", amount: 100, currency: "USD" as const, contractLanguage: "en" as const, buyerAcceptedTerms: true as const, buyerConsentedToData: true as const };
  const manualBeat = await makeBeat();
  const manual = await createManualExclusiveLicense({ ...buyer, beatId: manualBeat.id });
  assert.equal(manual.pdfReady, true);
  assert.equal((await prisma.beat.findUniqueOrThrow({ where: { id: manualBeat.id } })).status, "sold");
  await assert.rejects(createManualExclusiveLicense({ ...buyer, beatId: manualBeat.id }), /BEAT_NOT_AVAILABLE/);
  const first = await ensureOrderLicense(manual.orderId);
  const second = await ensureOrderLicense(manual.orderId);
  assert.equal(first.key, second.key);
  const download = await fetch(second.downloadUrl);
  assert.equal(download.status, 200);
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 20_000);
  await writeFile("/tmp/hamlo-license-qa.pdf", bytes);
  const manualOrder = await prisma.order.findUniqueOrThrow({ where: { id: manual.orderId }, include: { contract: true } });
  assert.equal(manualOrder.contract?.pdfKey, first.key);
  assert.ok(manualOrder.contract?.htmlSnapshot.includes(buyer.buyerName));

  const paidBeat = await makeBeat();
  const order = await prisma.order.create({ data: { beatId: paidBeat.id, buyerEmail: buyer.buyerEmail, buyerName: buyer.buyerName, buyerCity: buyer.buyerCity, buyerCountry: buyer.buyerCountry, basePriceUsd: 100, finalPriceUsd: 100, basePrice: 100, finalPrice: 100, currency: "USD", market: "global", provider: "stripe", paymentExternalId: `cs_test_${randomUUID()}`, status: "pending_payment", termsAcceptedAt: new Date(), personalDataConsentAt: new Date() } });
  const html = await renderContractHtml(toOrderRow(order), paidBeat);
  await prisma.contract.create({ data: { orderId: order.id, beatId: paidBeat.id, buyerEmail: buyer.buyerEmail, htmlSnapshot: html } });
  const webhook = async () => {
    const payload = JSON.stringify({ id: `evt_test_${order.id}`, type: "checkout.session.completed", data: { object: { id: order.paymentExternalId, metadata: { orderId: order.id }, client_reference_id: order.id, payment_status: "paid", amount_total: 10_000, currency: "usd" } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${payload}`).digest("hex");
    return stripeWebhook(new NextRequest("https://hamloprod.org/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signature}` }, body: payload }));
  };
  // A temporary storage failure must keep the paid sale and let the provider retry.
  const originalPut = ContaboS3Storage.prototype.putObject;
  ContaboS3Storage.prototype.putObject = async () => { throw new Error("simulated storage outage"); };
  try { assert.equal((await webhook()).status, 500); }
  finally { ContaboS3Storage.prototype.putObject = originalPut; }
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status, "paid");
  assert.equal((await prisma.beat.findUniqueOrThrow({ where: { id: paidBeat.id } })).status, "sold");
  assert.equal((await webhook()).status, 200);
  const issued = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { contract: true } });
  assert.ok(issued.contractPdfKey);
  assert.equal(issued.contract?.htmlSnapshot, html);
  assert.equal((await webhook()).status, 200);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).contractPdfKey, issued.contractPdfKey);
  const seller = await getSellerIdentity();
  await prisma.licenseSellerSetting.upsert({ where: { id: "default" }, create: { id: "default", identity: { ...seller, seller_name: "Updated Producer" } }, update: { identity: { ...seller, seller_name: "Updated Producer" } } });
  assert.equal((await ensureOrderLicense(order.id)).key, issued.contractPdfKey);
  assert.equal((await prisma.contract.findUniqueOrThrow({ where: { orderId: order.id } })).htmlSnapshot, html);
  await prisma.licenseSellerSetting.delete({ where: { id: "default" } });

  const contactBeat = await makeBeat();
  const contactOrder = await prisma.order.create({ data: { beatId: contactBeat.id, buyerEmail: buyer.buyerEmail, buyerName: buyer.buyerName, buyerCountry: buyer.buyerCountry, buyerCity: buyer.buyerCity, basePriceUsd: 100, finalPriceUsd: 100, basePrice: 100, finalPrice: 100, provider: "contact", termsAcceptedAt: new Date(), personalDataConsentAt: new Date() } });
  await assert.rejects(confirmManualOrder(contactOrder.id), /ORDER_NOT_READY/);
  const acceptedHtml = await renderContractHtml(toOrderRow(contactOrder), contactBeat);
  await prisma.contract.create({ data: { orderId: contactOrder.id, beatId: contactBeat.id, buyerEmail: buyer.buyerEmail, htmlSnapshot: acceptedHtml } });
  const confirmed = await confirmManualOrder(contactOrder.id);
  assert.equal(confirmed.pdfReady, true);
  const contactPdf = await ensureOrderLicense(contactOrder.id);
  assert.equal((await confirmManualOrder(contactOrder.id)).pdfReady, true);
  assert.equal((await ensureOrderLicense(contactOrder.id)).key, contactPdf.key);
  assert.equal((await prisma.contract.findUniqueOrThrow({ where: { orderId: contactOrder.id } })).htmlSnapshot, acceptedHtml);

  const draftBeat = await makeBeat();
  const draft = await prisma.order.create({ data: { beatId: draftBeat.id, buyerEmail: buyer.buyerEmail, basePriceUsd: 100, finalPriceUsd: 100, status: "draft" } });
  await assert.rejects(ensureOrderLicense(draft.id), /ORDER_NOT_READY_FOR_RIGHTS_FORM/);
  await prisma.order.update({ where: { id: draft.id }, data: { status: "paid", licenseType: "basic" } });
  await assert.rejects(ensureOrderLicense(draft.id), /LICENSE_TYPE_NOT_SUPPORTED/);
});
