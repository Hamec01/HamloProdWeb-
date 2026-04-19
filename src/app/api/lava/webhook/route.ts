import { NextRequest, NextResponse } from "next/server";
import {
  mapLavaWebhookToOrderStatus,
  verifyLavaWebhookSignature,
  type LavaWebhookPayload,
} from "@/lib/payments/lava";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function parseExternalId(payload: LavaWebhookPayload) {
  return (typeof payload.invoice_id === "string" && payload.invoice_id) || null;
}

async function ensureBeatSold(supabase: ReturnType<typeof createSupabaseAdminClient>, beatId: string, orderId: string) {
  const { error } = await supabase
    .from("beats")
    .update({
      status: "sold",
      available_for_download: false,
    })
    .eq("id", beatId);

  if (error) {
    console.error("[lava:webhook] beat status update failed", {
      error,
      beatId,
      orderId,
    });
    return false;
  }

  return true;
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

  const payload = ((): LavaWebhookPayload | null => {
    try {
      return JSON.parse(rawBody) as LavaWebhookPayload;
    } catch {
      return null;
    }
  })();
  if (!payload) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const externalId = parseExternalId(payload);

  if (!externalId) {
    return NextResponse.json({ error: "Missing external payment id." }, { status: 400 });
  }

  const nextStatus = mapLavaWebhookToOrderStatus(payload);

  if (!nextStatus) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_status" });
  }

  const supabase = createSupabaseAdminClient();

  const { data: currentOrder, error: currentOrderError } = await supabase
    .from("orders")
    .select("id, beat_id, status, paid_at")
    .eq("payment_external_id", externalId)
    .maybeSingle<{ id: string; beat_id: string; status: string; paid_at: string | null }>();

  if (currentOrderError) {
    console.error("[lava:webhook] order lookup failed", {
      error: currentOrderError,
      externalId,
    });
    return NextResponse.json({ error: "Failed to resolve order." }, { status: 500 });
  }

  if (!currentOrder) {
    return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });
  }

  if (currentOrder.status === nextStatus) {
    if (nextStatus === "paid") {
      const beatUpdated = await ensureBeatSold(supabase, currentOrder.beat_id, currentOrder.id);
      if (!beatUpdated) {
        return NextResponse.json({ error: "Failed to lock sold beat." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, orderId: currentOrder.id, status: nextStatus, idempotent: true });
  }

  if (currentOrder.status === "paid" && nextStatus === "failed") {
    return NextResponse.json({ ok: true, orderId: currentOrder.id, status: currentOrder.status, idempotent: true });
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
  };

  if (nextStatus === "paid") {
    patch.paid_at = new Date().toISOString();
    patch.rights_form_status = "not_started";
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .update(patch)
    .eq("payment_external_id", externalId)
    .select("id, beat_id")
    .maybeSingle<{ id: string; beat_id: string }>();

  if (orderError) {
    console.error("[lava:webhook] order status update failed", {
      error: orderError,
      externalId,
      nextStatus,
    });
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });
  }

  if (nextStatus === "paid") {
    const beatUpdated = await ensureBeatSold(supabase, order.beat_id, order.id);
    if (!beatUpdated) {
      return NextResponse.json({ error: "Failed to lock sold beat." }, { status: 500 });
    }
  }

  console.info("[lava:webhook] order status updated", {
    orderId: order.id,
    externalId,
    nextStatus,
  });

  return NextResponse.json({ ok: true, orderId: order.id, status: nextStatus, idempotent: false });
}
