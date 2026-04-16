import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPublicSessionState } from "@/lib/auth/session";
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
  base_price_usd: number;
  final_price_usd: number;
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

async function readSellerSignatureDataUri() {
  const signaturePath = process.env.SELLER_SIGNATURE_PATH?.trim() || "public/signatures/seller-signature.png";
  const assetsRoot = path.join(process.cwd(), "public", "signatures");
  const absolute = path.isAbsolute(signaturePath)
    ? signaturePath
    : path.join(assetsRoot, path.basename(signaturePath));

  const buffer = await readFile(absolute).catch(() => null);
  if (!buffer) {
    return "";
  }

  const ext = path.extname(absolute).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
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

function buildRightsContractHtml(args: {
  orderId: string;
  beatTitle: string;
  issueDate: string;
  basePrice: number;
  finalPrice: number;
  currency: string;
  sellerName: string;
  sellerCountry: string;
  sellerCity: string;
  sellerEmail: string;
  sellerSignatureDataUri: string;
  mode: "deferred" | "filled-now";
  buyerFullName: string;
  buyerCity: string;
  buyerStageName: string;
}) {
  const buyerFullName = args.mode === "deferred" ? "______________________" : escapeHtml(args.buyerFullName || "______________________");
  const buyerCity = args.mode === "deferred" ? "______________________" : escapeHtml(args.buyerCity || "______________________");
  const buyerStageName = args.mode === "deferred" ? "______________________" : escapeHtml(args.buyerStageName || "______________________");

  const sellerSignBlock = args.sellerSignatureDataUri
    ? `<img src="${args.sellerSignatureDataUri}" alt="Seller signature" style="height: 54px; width: auto; display: inline-block; vertical-align: middle;" />`
    : "______________________";

  return `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: "Times New Roman", serif; color: #101010; font-size: 12pt; line-height: 1.42; }
      h1 { font-size: 17pt; margin: 0 0 14px; text-align: center; }
      .meta { margin-bottom: 14px; }
      .box { border: 1px solid #1f1f1f; padding: 12px; margin: 14px 0; }
      .row { margin: 8px 0; }
      .muted { color: #444; font-size: 10pt; }
    </style>
  </head>
  <body>
    <h1>ДОГОВОР ПЕРЕДАЧИ ПРАВ НА МУЗЫКАЛЬНЫЙ БИТ</h1>
    <p class="meta">Номер: HP-${escapeHtml(args.orderId.slice(0, 8).toUpperCase())}<br />Дата: ${escapeHtml(args.issueDate)}</p>

    <div class="box">
      <div class="row"><strong>Продавец:</strong> ${escapeHtml(args.sellerName)}, ${escapeHtml(args.sellerCity)}, ${escapeHtml(args.sellerCountry)}, e-mail: ${escapeHtml(args.sellerEmail)}</div>
      <div class="row"><strong>Покупатель:</strong> ${buyerFullName}</div>
      <div class="row"><strong>Город покупателя:</strong> ${buyerCity}</div>
      <div class="row"><strong>Псевдоним артиста:</strong> ${buyerStageName}</div>
    </div>

    <p><strong>Объект:</strong> бит «${escapeHtml(args.beatTitle)}».</p>
    <p><strong>Стоимость:</strong> ${money(args.basePrice, args.currency)} (базовая), ${money(args.finalPrice, args.currency)} (итоговая).</p>

    <div class="box">
      <p><strong>Паспорт покупателя:</strong> ______________________</p>
      <p><strong>Подпись покупателя:</strong> ______________________</p>
      <p><strong>Подпись продавца:</strong> ${sellerSignBlock}</p>
    </div>

    <p class="muted">Документ с незаполненными ключевыми полями покупателя и без подписи покупателя является шаблоном/черновиком до завершения письменной формы.</p>
  </body>
</html>`;
}

export async function createRightsContractPdf(payload: ContractPdfCreatePayload) {
  const { supabase, userId } = await getContext();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_city, base_price_usd, final_price_usd, currency, status")
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

  if (payload.mode === "filled-now") {
    if (!payload.buyerFullName?.trim() || !payload.buyerCity?.trim() || !payload.buyerStageName?.trim()) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }
  }

  const sellerSignatureDataUri = await readSellerSignatureDataUri();
  const issueDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  const html = buildRightsContractHtml({
    orderId: order.id,
    beatTitle: beat.title,
    issueDate,
    basePrice: order.base_price_usd,
    finalPrice: order.final_price_usd,
    currency: order.currency?.trim() || "USD",
    sellerName: process.env.SELLER_NAME?.trim() || "HamloProd",
    sellerCountry: process.env.SELLER_COUNTRY?.trim() || "Finland",
    sellerCity: process.env.SELLER_CITY?.trim() || "Turku",
    sellerEmail: process.env.SELLER_EMAIL?.trim() || "Not specified",
    sellerSignatureDataUri,
    mode: payload.mode,
    buyerFullName: payload.buyerFullName?.trim() || order.buyer_name || "",
    buyerCity: payload.buyerCity?.trim() || order.buyer_city || "",
    buyerStageName: payload.buyerStageName?.trim() || "",
  });

  const pdfBuffer = await renderPdfFromHtml(html).catch(() => null);
  if (!pdfBuffer) {
    throw new Error("PDF_RENDER_FAILED");
  }

  const timestamp = Date.now();
  const storagePath = `orders/${order.id}/contract-${payload.mode}-${timestamp}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(CONTRACTS_PDF_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error("PDF_UPLOAD_FAILED");
  }

  const rightsFormStatus = payload.mode === "deferred" ? "deferred" : "completed_partial";

  const { error: updateOrderError } = await supabase
    .from("orders")
    .update({
      rights_form_status: rightsFormStatus,
      buyer_full_name: payload.mode === "filled-now" ? payload.buyerFullName?.trim() ?? null : null,
      buyer_city: payload.mode === "filled-now" ? payload.buyerCity?.trim() ?? null : order.buyer_city,
      buyer_stage_name: payload.mode === "filled-now" ? payload.buyerStageName?.trim() ?? null : null,
      contract_pdf_path: storagePath,
      contract_template_type: payload.mode,
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
    mode: payload.mode,
    storagePath,
    downloadUrl: signed.signedUrl,
  };
}
