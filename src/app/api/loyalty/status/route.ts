import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDiscountPercent } from "@/lib/loyalty";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ points: 0, discountPercent: 0, nextThreshold: 2 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ points: 0, discountPercent: 0, nextThreshold: 2 });
  }

  const { data } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", user.id)
    .maybeSingle<{ points: number }>();

  const points = data?.points ?? 0;
  const discountPercent = getDiscountPercent(points);
  const nextThreshold = points < 2 ? 2 : points < 4 ? 4 : null;

  return NextResponse.json({ points, discountPercent, nextThreshold });
}
