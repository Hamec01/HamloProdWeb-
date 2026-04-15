import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import {
  renderContractHtml,
  buildContractNumber,
  formatContractDate,
  type ContractLanguage,
} from "@/lib/contracts/templates";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type OrderRow = {
  id: string;
  beat_id: string;
  status: string;
  buyer_user_id: string;
  buyer_name: string | null;
  buyer_email: string;
  buyer_country: string | null;
  buyer_city: string | null;
  buyer_phone: string | null;
  license_type: string;
  contract_language: string;
  final_price_usd: number;
  created_at: string;
  beats: { title: string } | null;
};

const SELECT_FIELDS =
  "id, beat_id, status, buyer_user_id, buyer_name, buyer_email, " +
  "buyer_country, buyer_city, buyer_phone, license_type, contract_language, " +
  "final_price_usd, created_at, beats(title)";

export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) return err("Supabase not configured.", 503);

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => null)) as { orderId?: string } | null;
  if (!body?.orderId) return err("orderId is required.", 400);

  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select(SELECT_FIELDS)
    .eq("id", body.orderId)
    .maybeSingle<OrderRow>();

  if (!order) return err("Order not found.", 404);
  if (order.buyer_user_id !== session.userId) return err("Forbidden.", 403);

  const language = (["ru", "en", "bilingual"].includes(order.contract_language)
    ? order.contract_language
    : "ru") as ContractLanguage;

  const createdAt = new Date(order.created_at);
  const contractNumber = buildContractNumber(order.id, createdAt);
  const currentDate = formatContractDate(createdAt, language);

  const licenseLabel =
    order.license_type === "exclusive"
      ? language === "en"
        ? "Exclusive License"
        : "Эксклюзивная лицензия"
      : language === "en"
        ? "Basic (Non-Exclusive) License"
        : "Базовая (неисключительная) лицензия";

  const sellerName = process.env.NEXT_PUBLIC_SELLER_NAME ?? "HamloProd";
  const sellerCountry = process.env.NEXT_PUBLIC_SELLER_COUNTRY ?? "";
  const sellerCity = process.env.NEXT_PUBLIC_SELLER_CITY ?? "";

  const html = renderContractHtml(language, {
    contract_number: contractNumber,
    current_date: currentDate,
    beat_title: order.beats?.title ?? order.id,
    license_type: licenseLabel,
    buyer_name: order.buyer_name ?? "-",
    buyer_email: order.buyer_email,
    buyer_country: order.buyer_country ?? "-",
    buyer_city: order.buyer_city ?? "-",
    buyer_phone: order.buyer_phone ?? "-",
    amount: String(order.final_price_usd),
    currency: "USD",
    seller_name: sellerName,
    seller_country: sellerCountry,
    seller_city: sellerCity,
  });

  const { error: upsertError } = await supabase.from("contracts").upsert(
    {
      order_id: order.id,
      beat_id: order.beat_id,
      buyer_email: order.buyer_email,
      html_snapshot: html,
    },
    { onConflict: "order_id" },
  );

  if (upsertError) {
    return err("Failed to save contract snapshot.", 500);
  }

  return NextResponse.json({ previewUrl: "/checkout/preview/" + order.id }, { status: 200 });
}
