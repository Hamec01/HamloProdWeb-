import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  mapLavaWebhookToOrderStatus,
  verifyLavaWebhookSignature,
  type LavaWebhookPayload,
} from "@/lib/payments/lava";
import { awardSalePoints } from "@/lib/loyalty/award-sale";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";

export const runtime = "nodejs";
export const maxDuration = 120;

function parseExternalId(payload: LavaWebhookPayload) {
  return (typeof payload.invoice_id === "string" && payload.invoice_id) || null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.LAVA_WEBHOOK_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!webhookSecret) {
    console.error("[lava:webhook] missing LAVA_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyLavaWebhookSignature({ rawBody, authorizationHeader: authHeader, webhookSecret })) {
    console.warn("[lava:webhook] signature verification failed");
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  let payload: LavaWebhookPayload | null;
  try {
    payload = JSON.parse(rawBody) as LavaWebhookPayload;
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });

  const externalId = parseExternalId(payload);
  if (!externalId) return NextResponse.json({ error: "Missing external payment id." }, { status: 400 });

  const nextStatus = mapLavaWebhookToOrderStatus(payload);
  if (!nextStatus) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_status" });
  }

  const current = await prisma.order.findFirst({
    where: { paymentExternalId: externalId, provider: "lava" },
    select: { id: true, beatId: true, status: true, finalPrice: true, currency: true },
  });
  if (!current) return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });

  if (
    nextStatus === "paid" &&
    ((typeof payload.amount === "number" && payload.amount !== current.finalPrice) ||
      (typeof payload.currency === "string" && payload.currency.toUpperCase() !== (current.currency ?? "").toUpperCase()))
  ) {
    console.error("[lava:webhook] payment amount or currency mismatch", { orderId: current.id, externalId });
    return NextResponse.json({ error: "Payment amount or currency does not match the order." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: current.id, paymentExternalId: externalId, provider: "lava" },
        select: { id: true, beatId: true, status: true },
      });
      if (!order) return "not_found" as const;
      if (order.status === "paid" && nextStatus === "failed") return "duplicate" as const;
      if (order.status === nextStatus) { if (nextStatus === "paid") await awardSalePoints(tx, order.id); return "duplicate" as const; }
      if (order.status !== "pending_payment") return "conflict" as const;

      if (nextStatus === "failed") {
        await tx.order.updateMany({
          where: { id: order.id, status: "pending_payment", provider: "lava", paymentExternalId: externalId },
          data: { status: "failed" },
        });
        return "applied" as const;
      }

      if (!await lockBeatForExclusiveSale(tx, order.beatId)) return "conflict" as const;
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "pending_payment", provider: "lava", paymentExternalId: externalId },
        data: { status: "paid", paidAt: new Date(), rightsFormStatus: "not_started" },
      });
      if (updated.count !== 1) throw new Error("LAVA_ORDER_STATE_CHANGED");
      await awardSalePoints(tx, order.id);
      return "applied" as const;
    });

    if (result === "not_found") return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });
    if (result === "conflict") {
      console.error("[lava:webhook] payment conflicts with beat availability", { orderId: current.id, externalId });
      return NextResponse.json({ error: "Beat is no longer available; payment requires manual reconciliation." }, { status: 409 });
    }

    if (nextStatus === "paid") await ensureOrderLicense(current.id);

    if (result === "duplicate") {
      return NextResponse.json({ ok: true, orderId: current.id, status: current.status, idempotent: true });
    }
  } catch (error) {
    console.error("[lava:webhook] order status update failed", { externalId, nextStatus, error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }

  console.info("[lava:webhook] order status updated", { orderId: current.id, nextStatus });
  return NextResponse.json({ ok: true, orderId: current.id, status: nextStatus, idempotent: false });
}
