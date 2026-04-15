import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!hasSupabaseEnv()) {
    return err("Supabase not configured.", 503);
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return err("Unauthorized", 401);
  }

  const { orderId } = await params;

  const supabase = await createSupabaseServerClient();

  // Verify the order belongs to the current user
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_user_id")
    .eq("id", orderId)
    .maybeSingle<{ id: string; buyer_user_id: string }>();

  if (!order) {
    return err("Order not found.", 404);
  }

  if (order.buyer_user_id !== session.userId) {
    return err("Forbidden", 403);
  }

  // Fetch the contract HTML
  const { data: contract } = await supabase
    .from("contracts")
    .select("html_snapshot")
    .eq("order_id", orderId)
    .maybeSingle<{ html_snapshot: string }>();

  if (!contract) {
    return err("Contract not found.", 404);
  }

  return NextResponse.json({ html: contract.html_snapshot });
}
