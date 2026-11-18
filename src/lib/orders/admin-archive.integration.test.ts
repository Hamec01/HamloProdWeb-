import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { setRequestArchived } from "./admin-archive";
import { createBeatInquiry } from "./inquiries";
import { getConversation, sendOrderMessage } from "./conversation";

test("Admin archive preserves the request and reopens it only for fresh buyer activity", { skip: process.env.LICENSE_INTEGRATION_TEST !== "1", timeout: 30_000 }, async (t) => {
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/hamloprod_license_test");
  const suffix = randomUUID();
  const buyer = await prisma.user.create({ data: { email: `archive-${suffix}@example.invalid` } });
  const beat = await prisma.beat.create({ data: { title: "Archive test", slug: `archive-${suffix}`, caseNumber: `ARCHIVE-${suffix}`, genre: "trap", status: "available", publishedAt: new Date(), priceUsd: 20, priceRub: 2000 } });
  t.after(async () => {
    await prisma.beat.update({ where: { id: beat.id }, data: { reservationOrderId: null, reservationBuyerId: null } });
    await prisma.order.deleteMany({ where: { beatId: beat.id } });
    await prisma.beat.delete({ where: { id: beat.id } });
    await prisma.user.delete({ where: { id: buyer.id } });
    await prisma.$disconnect();
  });
  const request = await createBeatInquiry(beat.id, { userId: buyer.id, email: buyer.email }, "ru", true);
  const actor = { userId: buyer.id, role: "buyer" as const };
  const nonce = randomUUID();
  await sendOrderMessage(request.orderId, actor, "Хочу купить", nonce);
  const stockBefore = await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } });

  await t.test("hide and restore preserve buyer history, stock, amount and reservation", async () => {
    assert.equal(await setRequestArchived(request.orderId, true), true);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: request.orderId } });
    assert.ok(order.adminArchivedAt); assert.equal(order.status, "draft"); assert.equal(order.finalPrice, 2000);
    assert.deepEqual(await prisma.beat.findUniqueOrThrow({ where: { id: beat.id } }), stockBefore);
    assert.ok((await getConversation(order.id, actor)).messages.some((entry) => entry.text === "Хочу купить"));
    assert.equal(await setRequestArchived(order.id, false), true);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).adminArchivedAt, null);
  });
  await t.test("a duplicate buyer message does not reopen the archived request", async () => {
    await setRequestArchived(request.orderId, true);
    await sendOrderMessage(request.orderId, actor, "Хочу купить", nonce);
    assert.ok((await prisma.order.findUniqueOrThrow({ where: { id: request.orderId } })).adminArchivedAt);
  });
  await t.test("fresh buyer messages and a repeated purchase action reopen the existing request", async () => {
    await sendOrderMessage(request.orderId, actor, "Я вернулся, как оплатить?", randomUUID());
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: request.orderId } })).adminArchivedAt, null);
    await setRequestArchived(request.orderId, true);
    assert.equal((await createBeatInquiry(beat.id, { userId: buyer.id, email: buyer.email }, "ru", false)).orderId, request.orderId);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: request.orderId } })).adminArchivedAt, null);
  });
  await t.test("paid records and Stripe payments cannot be hidden with the draft-request action", async () => {
    await prisma.order.update({ where: { id: request.orderId }, data: { status: "paid" } });
    assert.equal(await setRequestArchived(request.orderId, true), false);
    await prisma.order.update({ where: { id: request.orderId }, data: { status: "draft", provider: "stripe" } });
    assert.equal(await setRequestArchived(request.orderId, true), false);
    assert.equal(await setRequestArchived(randomUUID(), true), false);
  });
});
