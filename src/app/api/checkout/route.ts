import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { checkoutFormSchema } from "@/lib/validations/checkout";
import {
  renderContractHtml,
  buildContractNumber,
  formatContractDate,
  type ContractLanguage,
} from "@/lib/contracts/templates";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const BEAT_SELECT_FIELDS = "id, title, price_usd, status";

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

  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select(BEAT_SELECT_FIELDS)
    .eq("id", beat_id)
    .maybeSingle<{ id: string; title: string; price_usd: number; status: string }>();

  if (beatError || !beat) {
    return err("Beat not found.", 404);
  }
  if (beat.status === "sold" || beat.status === "private") {
    return err("Beat is not available for purchase.", 409);
  }

  let discountPercent = 0;
  const { data: loyalty } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", session.userId)
    .maybeSingle<{ points: number }>();

  const points = loyalty?.points ?? 0;
  if (points >= 4) discountPercent = 100;
  else if (points >= 2) discountPercent = 50;

  const finalPriceUsd = Math.max(
    0,
    Math.round((beat.price_usd * (100 - discountPercent)) / 100),
  );

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
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
      status: "draft",
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (insertError || !order) {
    return err("Failed to create order.", 500);
  }

  const language = contract_language as ContractLanguage;
  const createdAt = new Date(order.created_at);
  const contractNumber = buildContractNumber(order.id, createdAt);
  const currentDate = formatContractDate(createdAt, language);

  const licenseLabel =
    license_type === "exclusive"
      ? language === "en"
        ? "Exclusive License"
        : "Эксклюзивная лицензия"
      : language === "en"
        ? "Basic (Non-Exclusive) License"
        : "Базовая (неисключительная) лицензия";

  const html = renderContractHtml(language, {
    contract_number: contractNumber,
    current_date: currentDate,
    beat_title: beat.title,
    license_type: licenseLabel,
    buyer_name: buyer_name ?? "-",
    buyer_email,
    buyer_country: buyer_country ?? "-",
    buyer_city: buyer_city ?? "-",
    buyer_phone: buyer_phone ?? "-",
    amount: String(finalPriceUsd),
    currency: "USD",
    seller_name: process.env.NEXT_PUBLIC_SELLER_NAME ?? "HamloProd",
    seller_country: process.env.NEXT_PUBLIC_SELLER_COUNTRY ?? "",
    seller_city: process.env.NEXT_PUBLIC_SELLER_CITY ?? "",
  });

  const { error: contractError } = await supabase.from("contracts").upsert(
    { order_id: order.id, beat_id, buyer_email, html_snapshot: html },
    { onConflict: "order_id" },
  );

  if (contractError) {
    return err("Failed to create contract preview.", 500);
  }

  return NextResponse.json(
    { orderId: order.id, previewUrl: "/checkout/preview/" + order.id },
    { status: 201 },
  );
}
