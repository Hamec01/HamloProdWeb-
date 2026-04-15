import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { checkoutFormSchema } from "@/lib/validations/checkout";
import { getDiscountPercent } from "@/lib/loyalty";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return err("Supabase not configured.", 503);
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return err("Unauthorized", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body) {
    return err("Invalid JSON body.", 400);
  }

  const parsed = checkoutFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const {
    beat_id,
    buyer_name,
    buyer_email,
    buyer_country,
    buyer_city,
    buyer_phone,
    license_type,
    contract_language,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Fetch beat to get price and confirm availability
  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select("id, price_usd, status")
    .eq("id", beat_id)
    .maybeSingle();

  if (beatError || !beat) {
    return err("Beat not found.", 404);
  }
  if (beat.status === "sold" || beat.status === "private") {
    return err("Beat is not available for purchase.", 409);
  }

  // Apply loyalty discount from backend source of truth.
  const { data: loyalty } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", session.userId)
    .maybeSingle();

  const points = loyalty?.points ?? 0;
  const discountPercent = getDiscountPercent(points);

  const finalPriceUsd = Math.max(0, Math.round((beat.price_usd * (100 - discountPercent)) / 100));

  const orderPayload = {
    beat_id,
    buyer_user_id: session.userId,
    buyer_email,
    buyer_name,
    buyer_country,
    buyer_city,
    buyer_phone,
    license_type,
    contract_language,
    base_price_usd: beat.price_usd,
    discount_percent: discountPercent,
    final_price_usd: finalPriceUsd,
    // Keep lifecycle backend-controlled even when final price is 0.
    status: "draft" as const,
  };

  const { data: existingDraft } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_user_id", session.userId)
    .eq("beat_id", beat_id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingDraft?.id) {
    const { error: updateError } = await supabase
      .from("orders")
      .update(orderPayload)
      .eq("id", existingDraft.id);

    if (updateError) {
      return err("Failed to update draft order.", 500);
    }

    return NextResponse.json({ orderId: existingDraft.id }, { status: 200 });
  }

  const { data: createdOrder, error: insertError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id")
    .single<{ id: string }>();

  if (insertError || !createdOrder) {
    return err("Failed to create order.", 500);
  }

  return NextResponse.json({ orderId: createdOrder.id }, { status: 201 });
}
