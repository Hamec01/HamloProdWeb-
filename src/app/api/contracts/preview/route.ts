import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import {
  getOrderForPreview,
  renderContractHtml,
  saveContractSnapshot,
} from "@/lib/contracts/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/contracts/preview
 *
 * Body: { orderId: string }
 *
 * Loads the order, re-renders the contract HTML, saves the snapshot, and
 * returns { previewUrl }.  Used for snapshot re-generation (e.g. if the
 * buyer navigates back to edit the order language).
 */
export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return err("Supabase not configured.", 503);
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return err("Unauthorized", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("orderId" in body)) {
    return err("Missing orderId.", 400);
  }

  const orderId = (body as Record<string, unknown>).orderId;
  if (typeof orderId !== "string" || !orderId) {
    return err("Invalid orderId.", 400);
  }

  const order = await getOrderForPreview(orderId, session.userId);
  if (!order) {
    return err("Order not found.", 404);
  }

  const supabase = await createSupabaseServerClient();
  const { data: beat } = await supabase
    .from("beats")
    .select("id, title, case_number")
    .eq("id", order.beat_id)
    .maybeSingle<{ id: string; title: string; case_number: string }>();

  if (!beat) {
    return err("Beat not found.", 404);
  }

  const html = renderContractHtml(order, beat);
  const contractId = await saveContractSnapshot(order, beat, html);

  if (!contractId) {
    return err("Failed to save contract snapshot.", 500);
  }

  const previewUrl = `/checkout/preview/${orderId}`;
  return NextResponse.json({ previewUrl, contractId }, { status: 200 });
}
