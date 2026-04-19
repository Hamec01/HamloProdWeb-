import { getPublicSessionState } from "@/lib/auth/session";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { renderExclusiveRightsRuTemplate } from "@/lib/contracts/templates/exclusive-rights-ru";
import { formatMarketMoney, type CurrencyCode } from "@/lib/market";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CONTRACT_DRAFT_PLACEHOLDER = "<p>Contract draft placeholder.</p>";

type OrderPreviewRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_country: string | null;
  buyer_city: string | null;
  buyer_phone: string | null;
  license_type: "basic" | "exclusive";
  contract_language: "ru" | "en";
  base_price: number | null;
  final_price: number | null;
  base_price_usd: number | null;
  final_price_usd: number | null;
  currency: string | null;
  market: string | null;
  status: string;
};

type BeatPreviewRow = {
  id: string;
  title: string;
  slug: string;
};

type ContractRow = {
  id: string;
  order_id: string;
  html_snapshot: string;
};

export type ContractTemplateName = "exclusive-rights-ru";

function parseContractRow(value: Record<string, unknown> | null | undefined): ContractRow | null {
  if (!value || typeof value.id !== "string" || typeof value.order_id !== "string") {
    return null;
  }

  return {
    id: value.id,
    order_id: value.order_id,
    html_snapshot: typeof value.html_snapshot === "string" ? value.html_snapshot : "",
  };
}

function getContractNumber(orderId: string) {
  return `HP-${orderId.slice(0, 8).toUpperCase()}`;
}

function getCurrentDate() {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export function resolveContractTemplate(_: "ru" | "en"): ContractTemplateName {
  return "exclusive-rights-ru";
}

function resolvePreviewCurrency(order: Pick<OrderPreviewRow, "currency" | "market" | "contract_language">): CurrencyCode {
  const normalizedCurrency = order.currency?.trim().toUpperCase();

  if (normalizedCurrency === "RUB" || normalizedCurrency === "USD") {
    return normalizedCurrency;
  }

  if (order.market === "ru" || order.contract_language === "ru") {
    return "RUB";
  }

  return "USD";
}

function resolvePreviewAmount(order: Pick<OrderPreviewRow, "final_price" | "base_price" | "final_price_usd" | "base_price_usd">) {
  const amount =
    typeof order.final_price === "number"
      ? order.final_price
      : typeof order.base_price === "number"
        ? order.base_price
        : typeof order.final_price_usd === "number"
          ? order.final_price_usd
          : typeof order.base_price_usd === "number"
            ? order.base_price_usd
            : null;

  if (amount === null || !Number.isFinite(amount)) {
    throw new Error("ORDER_FINAL_PRICE_MISSING");
  }

  return Math.max(0, amount);
}

function validatePreviewPayload(order: OrderPreviewRow, beat: BeatPreviewRow) {
  if (!beat.title?.trim()) {
    throw new Error("BEAT_TITLE_MISSING");
  }

  if (!order.buyer_email?.trim()) {
    throw new Error("BUYER_EMAIL_MISSING");
  }
}

async function getPreviewContext() {
  if (!hasSupabaseEnv()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = await createSupabaseServerClient();

  return {
    supabase,
    userId: session.userId,
  };
}

export async function getOrderForPreview(orderId: string) {
  const { supabase, userId } = await getPreviewContext();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_country, buyer_city, buyer_phone, license_type, contract_language, base_price, final_price, base_price_usd, final_price_usd, currency, market, status",
    )
    .eq("id", orderId)
    .eq("buyer_user_id", userId)
    .maybeSingle<OrderPreviewRow>();

  if (orderError || !order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select("id, title, slug")
    .eq("id", order.beat_id)
    .maybeSingle<BeatPreviewRow>();

  if (beatError || !beat) {
    throw new Error("BEAT_NOT_FOUND");
  }

  return { order, beat };
}

export async function getOrCreateContractDraft(orderId: string) {
  const { supabase } = await getPreviewContext();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, beat_id, buyer_email")
    .eq("id", orderId)
    .maybeSingle<{ id: string; beat_id: string; buyer_email: string }>();

  if (orderError || !order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const { data: existing, error: existingError } = await supabase
    .from("contracts")
    .select()
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingError) {
    throw new Error("CONTRACT_LOOKUP_FAILED");
  }

  const existingContract = parseContractRow(existing as Record<string, unknown> | null | undefined);

  if (existingContract) {
    return existingContract;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("contracts")
    .insert({
      order_id: order.id,
      beat_id: order.beat_id,
      buyer_email: order.buyer_email,
      ["html_snapshot"]: CONTRACT_DRAFT_PLACEHOLDER,
    })
    .select()
    .single();

  const insertedContract = parseContractRow(inserted as Record<string, unknown> | null | undefined);

  if (insertError || !insertedContract) {
    throw new Error("CONTRACT_CREATE_FAILED");
  }

  return insertedContract;
}

export async function getContractByOrderId(orderId: string) {
  const { supabase } = await getPreviewContext();

  const { data, error } = await supabase
    .from("contracts")
    .select()
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error("CONTRACT_LOOKUP_FAILED");
  }

  return parseContractRow(data as Record<string, unknown> | null | undefined);
}

export async function renderContractHtml(
  order: OrderPreviewRow,
  beat: BeatPreviewRow,
  _: ContractTemplateName,
) {
  validatePreviewPayload(order, beat);

  const seller = await getSellerIdentity({ strict: false, includeSignature: false });
  const currency = resolvePreviewCurrency(order);
  const finalPrice = resolvePreviewAmount(order);

  return renderExclusiveRightsRuTemplate({
    contract_number: getContractNumber(order.id),
    current_date: getCurrentDate(),
    beat_title: beat.title,
    price: formatMarketMoney(finalPrice, currency, currency === "RUB" ? "ru" : "en"),
    currency,
    ...seller,
    buyer_full_name: order.buyer_name,
    buyer_city: order.buyer_city,
    buyer_stage_name: null,
    mode: "deferred",
    revealSellerPassport: false,
  });
}

export async function saveContractSnapshot(contractId: string, html: string) {
  const { supabase } = await getPreviewContext();

  const { data, error } = await supabase
    .from("contracts")
    .update({
      ["html_snapshot"]: html,
      issued_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", contractId)
    .select()
    .single();

  const savedContract = parseContractRow(data as Record<string, unknown> | null | undefined);

  if (error || !savedContract) {
    throw new Error("CONTRACT_SAVE_FAILED");
  }

  return savedContract;
}

export async function generateAndSaveContractSnapshot(orderId: string) {
  const [{ order, beat }, contract] = await Promise.all([
    getOrderForPreview(orderId),
    getOrCreateContractDraft(orderId),
  ]);

  const template = resolveContractTemplate(order.contract_language);
  const html = await renderContractHtml(order, beat, template);
  const saved = await saveContractSnapshot(contract.id, html);

  return {
    order,
    beat,
    contract: saved,
    html,
    previewUrl: `/checkout/preview/${order.id}`,
  };
}
