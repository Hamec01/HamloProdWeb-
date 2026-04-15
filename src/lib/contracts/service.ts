/**
 * Contract service — server-side only.
 *
 * Helper functions used by the checkout API route and the
 * /api/contracts/preview endpoint:
 *
 *   getOrderForPreview(orderId, userId)
 *   getOrCreateContractDraft(orderId, userId)
 *   renderContractHtml(order, beat)
 *   saveContractSnapshot(contractId, html, orderId, userId)
 *
 * All Supabase calls are made with the authenticated server client so that
 * RLS is respected throughout.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  renderContractByLocale,
  type ContractLocale,
  type ContractVars,
} from "@/lib/contracts/templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderForPreview = {
  id: string;
  beat_id: string;
  buyer_user_id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_country: string | null;
  buyer_city: string | null;
  buyer_phone: string | null;
  license_type: string;
  contract_language: string;
  base_price_usd: number;
  discount_percent: number;
  final_price_usd: number;
  status: string;
  created_at: string;
};

export type BeatForPreview = {
  id: string;
  title: string;
  case_number: string;
};

export type ContractDraft = {
  id: string;
  order_id: string;
  beat_id: string;
  buyer_email: string;
  html_snapshot: string;
};

// ---------------------------------------------------------------------------
// Seller defaults (TODO: replace with site_settings or env-based config once
// a seller_settings table or env vars are available)
// ---------------------------------------------------------------------------
const SELLER_NAME = process.env.SELLER_NAME ?? "HamloProd";
const SELLER_COUNTRY = process.env.SELLER_COUNTRY ?? "Russia";
const SELLER_CITY = process.env.SELLER_CITY ?? "Moscow";

// ---------------------------------------------------------------------------
// getOrderForPreview
// ---------------------------------------------------------------------------

/**
 * Load a single order from Supabase, verifying it belongs to userId.
 * Returns null if not found or access is denied.
 */
export async function getOrderForPreview(
  orderId: string,
  userId: string,
): Promise<OrderForPreview | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_country, buyer_city, buyer_phone, license_type, contract_language, base_price_usd, discount_percent, final_price_usd, status, created_at",
    )
    .eq("id", orderId)
    .eq("buyer_user_id", userId)
    .maybeSingle<OrderForPreview>();

  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// getOrCreateContractDraft
// ---------------------------------------------------------------------------

/**
 * Fetch an existing contract draft for an order.
 * Returns null if no contract exists yet — the caller should create one via
 * renderContractHtml + saveContractSnapshot.
 */
export async function getContractForOrder(
  orderId: string,
): Promise<ContractDraft | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contracts")
    .select("id, order_id, beat_id, buyer_email, html_snapshot")
    .eq("order_id", orderId)
    .maybeSingle<ContractDraft>();

  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// renderContractHtml
// ---------------------------------------------------------------------------

/**
 * Render a full HTML contract from the given order and beat.
 * The rendered HTML is safe to store in contracts.html_snapshot and to
 * display via dangerouslySetInnerHTML after stripping <script> tags on
 * the consumer side.
 */
export function renderContractHtml(
  order: OrderForPreview,
  beat: BeatForPreview,
): string {
  const locale = (
    ["ru", "en", "bilingual"].includes(order.contract_language)
      ? order.contract_language
      : "ru"
  ) as ContractLocale;

  const year = new Date().getFullYear();
  const contractNumber = `HP-${year}-${order.id.slice(0, 8).toUpperCase()}`;

  const currentDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    dateStyle: "long",
  }).format(new Date());

  const currency = "USD";
  const amount =
    order.final_price_usd === 0
      ? locale === "en"
        ? "0 (complimentary)"
        : "0 (безвозмездно)"
      : String(order.final_price_usd);

  const vars: ContractVars = {
    contract_number: contractNumber,
    current_date: currentDate,
    beat_title: beat.title,
    license_type: order.license_type,
    buyer_name: order.buyer_name ?? "",
    buyer_email: order.buyer_email,
    buyer_country: order.buyer_country ?? "",
    buyer_city: order.buyer_city ?? "",
    buyer_phone: order.buyer_phone ?? "",
    amount,
    currency,
    seller_name: SELLER_NAME,
    seller_country: SELLER_COUNTRY,
    seller_city: SELLER_CITY,
  };

  return renderContractByLocale(locale, vars);
}

// ---------------------------------------------------------------------------
// saveContractSnapshot
// ---------------------------------------------------------------------------

/**
 * Create or update a contract record for the given order.
 *
 * On first call  → inserts a new row (RLS: buyer owns the order).
 * On repeat call → updates html_snapshot on the existing row.
 *
 * Returns the contract id on success, null on failure.
 */
export async function saveContractSnapshot(
  order: OrderForPreview,
  beat: BeatForPreview,
  htmlSnapshot: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // Try to update an existing contract first
  const existing = await getContractForOrder(order.id);

  if (existing) {
    const { error } = await supabase
      .from("contracts")
      .update({ html_snapshot: htmlSnapshot })
      .eq("id", existing.id);

    if (error) return null;
    return existing.id;
  }

  // Insert a new contract record
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      order_id: order.id,
      beat_id: beat.id,
      buyer_email: order.buyer_email,
      html_snapshot: htmlSnapshot,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------------
// getContractSnapshotForPreview
// ---------------------------------------------------------------------------

/**
 * Returns the saved html_snapshot for a given orderId, or null if missing.
 * Used by the preview page to load the document without re-rendering.
 */
export async function getContractSnapshotForPreview(
  orderId: string,
): Promise<{ contractId: string; htmlSnapshot: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("contracts")
    .select("id, html_snapshot")
    .eq("order_id", orderId)
    .maybeSingle<{ id: string; html_snapshot: string }>();

  if (error || !data) return null;
  return { contractId: data.id, htmlSnapshot: data.html_snapshot };
}
