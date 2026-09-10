/**
 * Adapter between the Prisma `Order` / `Contract` models and the snake_case row
 * shapes the checkout / payment / contract code and pages were written against
 * (originally Supabase `.select(...)` results). Keeping the shapes lets the
 * migration touch the data layer only, not every page.
 */

import type { Order as PrismaOrder, Contract as PrismaContract } from "@prisma/client";

export type OrderRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_country: string | null;
  buyer_city: string | null;
  buyer_phone: string | null;
  buyer_full_name: string | null;
  buyer_stage_name: string | null;
  base_price: number | null;
  final_price: number | null;
  base_price_usd: number | null;
  final_price_usd: number | null;
  discount_percent: number;
  currency: string | null;
  market: string | null;
  provider: string | null;
  payment_provider: string | null;
  payment_external_id: string | null;
  payment_url: string | null;
  status: string;
  license_type: "basic" | "exclusive";
  contract_language: "ru" | "en";
  rights_form_status: "not_started" | "deferred" | "completed_partial" | null;
  contract_pdf_key: string | null;
  contract_template_type: string | null;
  paid_at: string | null;
  created_at: string;
};

export function toOrderRow(o: PrismaOrder): OrderRow {
  return {
    id: o.id,
    beat_id: o.beatId,
    buyer_user_id: o.buyerUserId,
    buyer_email: o.buyerEmail,
    buyer_name: o.buyerName,
    buyer_country: o.buyerCountry,
    buyer_city: o.buyerCity,
    buyer_phone: o.buyerPhone,
    buyer_full_name: o.buyerFullName,
    buyer_stage_name: o.buyerStageName,
    base_price: o.basePrice,
    final_price: o.finalPrice,
    base_price_usd: o.basePriceUsd,
    final_price_usd: o.finalPriceUsd,
    discount_percent: o.discountPercent,
    currency: o.currency,
    market: o.market,
    provider: o.provider,
    payment_provider: o.paymentProvider,
    payment_external_id: o.paymentExternalId,
    payment_url: o.paymentUrl,
    status: o.status,
    license_type: o.licenseType as "basic" | "exclusive",
    contract_language: o.contractLanguage as "ru" | "en",
    rights_form_status: o.rightsFormStatus as OrderRow["rights_form_status"],
    contract_pdf_key: o.contractPdfKey,
    contract_template_type: o.contractTemplateType,
    paid_at: o.paidAt ? o.paidAt.toISOString() : null,
    created_at: o.createdAt.toISOString(),
  };
}

export type ContractRow = {
  id: string;
  order_id: string;
  beat_id: string;
  buyer_email: string;
  html_snapshot: string;
  pdf_key: string | null;
};

export function toContractRow(c: PrismaContract): ContractRow {
  return {
    id: c.id,
    order_id: c.orderId,
    beat_id: c.beatId,
    buyer_email: c.buyerEmail,
    html_snapshot: c.htmlSnapshot,
    pdf_key: c.pdfKey,
  };
}
