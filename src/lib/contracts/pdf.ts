import { getPublicSessionState } from "@/lib/auth/public-session";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { renderExclusiveRightsRuTemplate, type ExclusiveRightsRenderMode } from "@/lib/contracts/templates/exclusive-rights-ru";
import { formatMarketMoney } from "@/lib/market";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { CONTRACTS_PDF_BUCKET } from "@/lib/storage/media";
import type { ContractPdfCreatePayload } from "@/lib/validations/rights-form";

type OrderPdfRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_city: string | null;
  base_price: number | null;
  final_price: number | null;
  base_price_usd: number | null;
  final_price_usd: number | null;
  currency: string | null;
  status: string;
};

type BeatPdfRow = {
  id: string;
  title: string;
};

function escapeHtml(input: string | null | undefined) {
  return (input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(value: number, currency: string) {
  const locale = currency.toUpperCase() === "RUB" ? "ru-RU" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase() === "RUB" ? "RUB" : "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function getContext() {
  if (!hasSupabaseEnv()) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = await createSupabaseServerClient();
  return { supabase, userId: session.userId };
}

function getContractNumber(orderId: string) {
  return `HP-${orderId.slice(0, 8).toUpperCase()}`;
}

function normalizePdfMode(mode: ContractPdfCreatePayload["mode"]): ExclusiveRightsRenderMode {
  return mode === "deferred" ? "deferred" : "partial";
}

async function renderPdfFromHtml(html: string) {
  const { default: chromium } = await import("@sparticuz/chromium-min");
  const puppeteer = await import("puppeteer-core");

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const data = await page.pdf({
      printBackground: true,
      format: "A4",
      margin: {
        top: "20mm",
        right: "14mm",
        bottom: "20mm",
        left: "14mm",
      },
    });

    return data;
  } finally {
    await browser.close();
  }
}


export async function createRightsContractPdf(payload: ContractPdfCreatePayload) {
  const { supabase, userId } = await getContext();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_city, base_price, final_price, base_price_usd, final_price_usd, currency, status")
    .eq("id", payload.orderId)
    .eq("buyer_user_id", userId)
    .maybeSingle<OrderPdfRow>();

  if (orderError || !order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (order.status !== "paid" && order.status !== "pending_free_checkout") {
    throw new Error("ORDER_NOT_READY_FOR_RIGHTS_FORM");
  }

  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select("id, title")
    .eq("id", order.beat_id)
    .maybeSingle<BeatPdfRow>();

  if (beatError || !beat) {
    throw new Error("BEAT_NOT_FOUND");
  }

  const mode = normalizePdfMode(payload.mode);

  if (mode === "partial") {
    if (!payload.buyerFullName?.trim() || !payload.buyerCity?.trim() || !payload.buyerStageName?.trim()) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }
  }

  const seller = await getSellerIdentity();
  const issueDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const currency = resolveOrderCurrency(order);
  const html = renderExclusiveRightsRuTemplate({
    contract_number: getContractNumber(order.id),
    current_date: issueDate,
    beat_title: beat.title,
    price: formatMarketMoney(resolveOrderFinalPrice(order), currency, currency === "RUB" ? "ru" : "en"),
    currency,
    ...seller,
    seller_signature_image: seller.seller_signature_image,
    mode,
    buyer_full_name: payload.buyerFullName?.trim() || order.buyer_name || "",
    buyer_city: payload.buyerCity?.trim() || order.buyer_city || "",
    buyer_stage_name: payload.buyerStageName?.trim() || "",
    revealSellerPassport: true,
  });

  const pdfBuffer = await renderPdfFromHtml(html).catch(() => null);
  if (!pdfBuffer) {
    throw new Error("PDF_RENDER_FAILED");
  }

  const timestamp = Date.now();
  const storagePath = `orders/${order.id}/contract-${mode}-${timestamp}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(CONTRACTS_PDF_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error("PDF_UPLOAD_FAILED");
  }

  const rightsFormStatus = mode === "deferred" ? "deferred" : "completed_partial";

  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({
      rights_form_status: rightsFormStatus,
      buyer_full_name: mode === "partial" ? payload.buyerFullName?.trim() ?? null : null,
      buyer_city: mode === "partial" ? payload.buyerCity?.trim() ?? null : order.buyer_city,
      buyer_stage_name: mode === "partial" ? payload.buyerStageName?.trim() ?? null : null,
      contract_pdf_path: storagePath,
      contract_template_type: mode,
    })
    .eq("id", order.id);

  if (updateOrderError) {
    throw new Error("ORDER_UPDATE_FAILED");
  }

  const { error: updateContractError } = await supabase
    .from("contracts")
    .update({ pdf_path: storagePath })
    .eq("order_id", order.id);

  if (updateContractError) {
    throw new Error("CONTRACT_UPDATE_FAILED");
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(CONTRACTS_PDF_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError || !signed?.signedUrl) {
    throw new Error("PDF_SIGN_URL_FAILED");
  }

  return {
    orderId: order.id,
    mode,
    storagePath,
    downloadUrl: signed.signedUrl,
  };
}
