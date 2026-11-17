import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe";
import { awardSalePoints } from "@/lib/loyalty/award-sale";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function handleBeatStripeWebhook(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[stripe:webhook] missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: request.headers.get("stripe-signature"),
    webhookSecret,
  })) {
    console.warn("[stripe:webhook] signature verification failed");
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (!isRecord(event) || typeof event.type !== "string" || !isRecord(event.data) || !isRecord(event.data.object)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = event.type;
  const session = event.data.object;
  const sessionId = getString(session.id);
  const metadata = isRecord(session.metadata) ? session.metadata : null;
  const orderId = metadata ? getString(metadata.orderId) : null;
  if (!sessionId || !orderId) {
    return NextResponse.json({ error: "Missing checkout session or order id." }, { status: 400 });
  }

  const isPaidEvent = eventType === "checkout.session.async_payment_succeeded" ||
    (eventType === "checkout.session.completed" && session.payment_status === "paid");
  const isFailedEvent = eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired";

  if (!isPaidEvent && !isFailedEvent) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const current = await prisma.order.findFirst({
    where: { paymentExternalId: sessionId, provider: "stripe" },
    select: { id: true, beatId: true, status: true, finalPrice: true, currency: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Order not found for checkout session." }, { status: 404 });
  }
  if (current.id !== orderId) {
    return NextResponse.json({ error: "Checkout session order does not match." }, { status: 400 });
  }
  const clientReferenceId = getString(session.client_reference_id);
  if (clientReferenceId && clientReferenceId !== orderId) {
    return NextResponse.json({ error: "Checkout session reference does not match." }, { status: 400 });
  }

  if (isFailedEvent) {
    if (current.status === "paid") {
      return NextResponse.json({ ok: true, status: "paid", idempotent: true });
    }

    await prisma.order.updateMany({
      where: { id: current.id, provider: "stripe", paymentExternalId: sessionId, status: "pending_payment" },
      data: { status: "failed" },
    });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const amountTotal = session.amount_total;
  const currency = getString(session.currency)?.toLowerCase();
  if (
    session.payment_status !== "paid" ||
    typeof amountTotal !== "number" ||
    !Number.isSafeInteger(amountTotal) ||
    amountTotal !== current.finalPrice * 100 ||
    currency !== (current.currency ?? "").toLowerCase() ||
    currency !== "usd"
  ) {
    console.error("[stripe:webhook] payment amount or currency mismatch", { orderId: current.id, sessionId });
    return NextResponse.json({ error: "Payment amount or currency does not match the order." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: current.id, provider: "stripe", paymentExternalId: sessionId },
        select: { id: true, beatId: true, status: true },
      });
      if (!order) return "not_found" as const;

      if (order.status === "paid") {
        await awardSalePoints(tx, order.id);
        await tx.beat.update({
          where: { id: order.beatId },
          data: { status: "sold", availableForDownload: false },
        });
        return "duplicate" as const;
      }
      if (order.status !== "pending_payment") return "conflict" as const;

      if (!await lockBeatForExclusiveSale(tx, order.beatId)) return "conflict" as const;

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "pending_payment", provider: "stripe", paymentExternalId: sessionId },
        data: { status: "paid", paidAt: new Date(), rightsFormStatus: "not_started" },
      });
      if (updated.count !== 1) {
        throw new Error("STRIPE_ORDER_STATE_CHANGED");
      }

      await awardSalePoints(tx, order.id);
      return "applied" as const;
    });

    if (result === "not_found") return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (result === "conflict") {
      console.error("[stripe:webhook] paid order conflicts with beat availability", { orderId: current.id, sessionId });
      return NextResponse.json({ error: "Beat is no longer available; payment requires manual reconciliation." }, { status: 409 });
    }

    await ensureOrderLicense(current.id);

    console.info("[stripe:webhook] order payment confirmed", { orderId: current.id, idempotent: result === "duplicate" });
    return NextResponse.json({ ok: true, orderId: current.id, status: "paid", idempotent: result === "duplicate" });
  } catch (error) {
    console.error("[stripe:webhook] payment confirmation failed", {
      orderId: current.id,
      sessionId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Failed to confirm payment." }, { status: 500 });
  }
}
