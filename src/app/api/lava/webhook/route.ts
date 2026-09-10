import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  mapLavaWebhookToOrderStatus,
  verifyLavaWebhookSignature,
  type LavaWebhookPayload,
} from "@/lib/payments/lava";

export const runtime = "nodejs";

function parseExternalId(payload: LavaWebhookPayload) {
  return (typeof payload.invoice_id === "string" && payload.invoice_id) || null;
}

async function ensureBeatSold(beatId: string, orderId: string) {
  try {
    await prisma.beat.update({ where: { id: beatId }, data: { status: "sold", availableForDownload: false } });
    return true;
  } catch (error) {
    console.error("[lava:webhook] beat status update failed", { beatId, orderId, error: error instanceof Error ? error.message : "unknown" });
    return false;
  }
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
    where: { paymentExternalId: externalId },
    select: { id: true, beatId: true, status: true },
  });
  if (!current) return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });

  // Idempotent re-delivery of the same terminal state.
  if (current.status === nextStatus) {
    if (nextStatus === "paid" && !(await ensureBeatSold(current.beatId, current.id))) {
      return NextResponse.json({ error: "Failed to lock sold beat." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, orderId: current.id, status: nextStatus, idempotent: true });
  }

  // A late "failed" for an already-paid order is ignored (needs manual refund reconciliation).
  if (current.status === "paid" && nextStatus === "failed") {
    return NextResponse.json({ ok: true, orderId: current.id, status: current.status, idempotent: true });
  }

  try {
    await prisma.order.updateMany({
      where: { paymentExternalId: externalId },
      data: {
        status: nextStatus,
        ...(nextStatus === "paid" ? { paidAt: new Date(), rightsFormStatus: "not_started" } : {}),
      },
    });
  } catch (error) {
    console.error("[lava:webhook] order status update failed", { externalId, nextStatus, error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }

  if (nextStatus === "paid" && !(await ensureBeatSold(current.beatId, current.id))) {
    return NextResponse.json({ error: "Failed to lock sold beat." }, { status: 500 });
  }

  console.info("[lava:webhook] order status updated", { orderId: current.id, nextStatus });
  return NextResponse.json({ ok: true, orderId: current.id, status: nextStatus, idempotent: false });
}
