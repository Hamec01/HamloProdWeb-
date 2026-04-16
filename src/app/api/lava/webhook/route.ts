import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function parseExternalId(payload: Record<string, unknown>) {
  const data = (payload.data as Record<string, unknown> | undefined) ?? null;

  return (
    (typeof payload.invoiceId === "string" && payload.invoiceId) ||
    (typeof payload.invoice_id === "string" && payload.invoice_id) ||
    (typeof payload.paymentId === "string" && payload.paymentId) ||
    (typeof payload.payment_id === "string" && payload.payment_id) ||
    (typeof payload.id === "string" && payload.id) ||
    (typeof data?.invoiceId === "string" && data.invoiceId) ||
    (typeof data?.invoice_id === "string" && data.invoice_id) ||
    (typeof data?.paymentId === "string" && data.paymentId) ||
    (typeof data?.payment_id === "string" && data.payment_id) ||
    null
  );
}

function parseEvent(payload: Record<string, unknown>) {
  return (
    (typeof payload.event === "string" && payload.event) ||
    (typeof payload.type === "string" && payload.type) ||
    (typeof payload.status === "string" && payload.status) ||
    ""
  ).toLowerCase();
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LAVA_WEBHOOK_SECRET?.trim();
  const incomingSecret = request.headers.get("x-api-key")?.trim();

  if (!expectedSecret || !incomingSecret || incomingSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = parseEvent(payload);
  const externalId = parseExternalId(payload);

  if (!externalId) {
    return NextResponse.json({ error: "Missing external payment id." }, { status: 400 });
  }

  let nextStatus: "paid" | "failed" | null = null;
  if (event.includes("success") || event === "paid") {
    nextStatus = "paid";
  }
  if (event.includes("failed") || event === "failed" || event.includes("cancel")) {
    nextStatus = "failed";
  }

  if (!nextStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createSupabaseAdminClient();

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
    .select("id")
    .maybeSingle<{ id: string }>();

  if (orderError) {
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found for payment id." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, orderId: order.id, status: nextStatus });
}
