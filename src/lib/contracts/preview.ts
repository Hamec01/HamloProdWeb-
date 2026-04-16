import { getPublicSessionState } from "@/lib/auth/session";
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
  final_price_usd: number;
  currency: string | null;
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

type SellerDetails = {
  sellerName: string;
  sellerCountry: string;
  sellerCity: string;
};

export type ContractTemplateName = "license-ru" | "license-en" | "license-bilingual";

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

function escapeHtml(input: string | null | undefined) {
  return (input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getSellerDetails(): SellerDetails {
  return {
    sellerName: process.env.SELLER_NAME?.trim() || process.env.NEXT_PUBLIC_SELLER_NAME?.trim() || "HamloProd",
    sellerCountry: process.env.SELLER_COUNTRY?.trim() || process.env.NEXT_PUBLIC_SELLER_COUNTRY?.trim() || "Not specified",
    sellerCity: process.env.SELLER_CITY?.trim() || process.env.NEXT_PUBLIC_SELLER_CITY?.trim() || "Not specified",
  };
}

function getContractNumber(orderId: string) {
  return `HP-${orderId.slice(0, 8).toUpperCase()}`;
}

function getCurrentDate(contractLanguage: "ru" | "en") {
  return new Intl.DateTimeFormat(contractLanguage === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function getLicenseLabel(language: "ru" | "en", licenseType: "basic" | "exclusive") {
  if (language === "ru") {
    return licenseType === "exclusive" ? "Эксклюзивная" : "Базовая";
  }

  return licenseType === "exclusive" ? "Exclusive" : "Basic";
}

export function resolveContractTemplate(contractLanguage: "ru" | "en"): ContractTemplateName {
  if (contractLanguage === "ru") {
    return "license-ru";
  }

  if (contractLanguage === "en") {
    return "license-en";
  }

  return "license-bilingual";
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
      "id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_country, buyer_city, buyer_phone, license_type, contract_language, final_price_usd, currency, status",
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

export function renderContractHtml(
  order: OrderPreviewRow,
  beat: BeatPreviewRow,
  template: ContractTemplateName,
) {
  const contractNumber = escapeHtml(getContractNumber(order.id));
  const currentDate = escapeHtml(getCurrentDate(order.contract_language));
  const beatTitle = escapeHtml(beat.title);
  const licenseType = escapeHtml(getLicenseLabel(order.contract_language, order.license_type));
  const buyerName = escapeHtml(order.buyer_name ?? "Not specified");
  const buyerEmail = escapeHtml(order.buyer_email);
  const buyerCountry = escapeHtml(order.buyer_country ?? "Not specified");
  const buyerCity = escapeHtml(order.buyer_city ?? "Not specified");
  const buyerPhone = escapeHtml(order.buyer_phone ?? "Not specified");
  const amount = escapeHtml(formatAmount(order.final_price_usd));
  const currency = "USD";
  const seller = getSellerDetails();
  const sellerName = escapeHtml(seller.sellerName);
  const sellerCountry = escapeHtml(seller.sellerCountry);
  const sellerCity = escapeHtml(seller.sellerCity);

  const commonMeta = `
    <p><strong>contract_number:</strong> ${contractNumber}</p>
    <p><strong>current_date:</strong> ${currentDate}</p>
    <p><strong>beat_title:</strong> ${beatTitle}</p>
    <p><strong>license_type:</strong> ${licenseType}</p>
    <p><strong>buyer_name:</strong> ${buyerName}</p>
    <p><strong>buyer_email:</strong> ${buyerEmail}</p>
    <p><strong>buyer_country:</strong> ${buyerCountry}</p>
    <p><strong>buyer_city:</strong> ${buyerCity}</p>
    <p><strong>buyer_phone:</strong> ${buyerPhone}</p>
    <p><strong>amount:</strong> ${amount}</p>
    <p><strong>currency:</strong> ${currency}</p>
    <p><strong>seller_name:</strong> ${sellerName}</p>
    <p><strong>seller_country:</strong> ${sellerCountry}</p>
    <p><strong>seller_city:</strong> ${sellerCity}</p>
  `;

  const ruBody = `
    <h1>Лицензионный договор</h1>
    <p>Продавец ${sellerName} предоставляет Покупателю ${buyerName} лицензию на бит «${beatTitle}».</p>
    <p>Тип лицензии: ${licenseType}. Стоимость: ${amount} ${currency}.</p>
    <p>Покупатель подтверждает корректность данных: ${buyerEmail}, ${buyerPhone}, ${buyerCountry}, ${buyerCity}.</p>
  `;

  const enBody = `
    <h1>License Agreement</h1>
    <p>Seller ${sellerName} grants Buyer ${buyerName} a license for the beat "${beatTitle}".</p>
    <p>License type: ${licenseType}. Amount: ${amount} ${currency}.</p>
    <p>Buyer confirms the provided details: ${buyerEmail}, ${buyerPhone}, ${buyerCountry}, ${buyerCity}.</p>
  `;

  let body = "";
  if (template === "license-ru") {
    body = ruBody;
  } else if (template === "license-en") {
    body = enBody;
  } else {
    body = `${ruBody}<hr />${enBody}`;
  }

  return `
<!doctype html>
<html lang="${order.contract_language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Contract ${contractNumber}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; padding: 28px; font-family: "IBM Plex Mono", Menlo, monospace; background: #f6f2e8; color: #1f1b16; }
      .doc { max-width: 960px; margin: 0 auto; background: #fffef9; border: 1px solid #d4c9b2; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 28px; letter-spacing: 0.04em; text-transform: uppercase; }
      p { margin: 8px 0; line-height: 1.55; }
      hr { border: 0; border-top: 1px solid #d4c9b2; margin: 18px 0; }
      .meta { margin-bottom: 14px; padding: 12px; border: 1px solid #e5dcc9; background: #faf6eb; }
    </style>
  </head>
  <body>
    <main class="doc">
      <section class="meta">${commonMeta}</section>
      ${body}
    </main>
  </body>
</html>`;
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
  const html = renderContractHtml(order, beat, template);
  const saved = await saveContractSnapshot(contract.id, html);

  return {
    order,
    beat,
    contract: saved,
    html,
    previewUrl: `/checkout/preview/${order.id}`,
  };
}
