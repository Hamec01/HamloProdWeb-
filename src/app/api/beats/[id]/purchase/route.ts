import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getDiscountPercent(points: number) {
  if (points >= 4) {
    return 100;
  }

  if (points >= 2) {
    return 50;
  }

  return 0;
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return errorResponse("Supabase env is not configured.", 503);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Login required.", 401);
  }

  const { id } = await params;
  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select("id, title, price_usd")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; price_usd: number }>();

  if (beatError || !beat) {
    return errorResponse("Beat not found.", 404);
  }

  const { data: pointsRow } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", user.id)
    .maybeSingle<{ points: number }>();

  const pointsBefore = pointsRow?.points ?? 0;
  const discountPercent = getDiscountPercent(pointsBefore);
  const finalPriceUsd = Math.max(0, Math.round((beat.price_usd * (100 - discountPercent)) / 100));
  const pointsAfter = pointsBefore + 1;

  const { error: purchaseError } = await supabase.from("beat_purchases").insert({
    beat_id: beat.id,
    beat_title: beat.title,
    user_id: user.id,
    user_email: user.email ?? "unknown",
    base_price_usd: beat.price_usd,
    discount_percent: discountPercent,
    final_price_usd: finalPriceUsd,
    points_earned: 1,
  });

  if (purchaseError) {
    return errorResponse(purchaseError.message, 400);
  }

  const { error: pointsError } = await supabase.from("user_loyalty_points").upsert(
    {
      user_id: user.id,
      user_email: user.email ?? "unknown",
      points: pointsAfter,
    },
    { onConflict: "user_id" },
  );

  if (pointsError) {
    return errorResponse(pointsError.message, 400);
  }

  return NextResponse.json({
    basePriceUsd: beat.price_usd,
    finalPriceUsd,
    discountPercent,
    pointsBefore,
    pointsAfter,
    pointsEarned: 1,
  });
}
