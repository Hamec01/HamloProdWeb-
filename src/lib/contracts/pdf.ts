import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { renderExclusiveRightsRuTemplate, type ExclusiveRightsRenderMode } from "@/lib/contracts/templates/exclusive-rights-ru";
import { formatMarketMoney } from "@/lib/market";
import { resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { toOrderRow } from "@/lib/orders/order-row";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";
import type { ContractPdfCreatePayload } from "@/lib/validations/rights-form";

async function requireBuyerUserId(): Promise<string> {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) throw new Error("UNAUTHORIZED");
  return session.userId;
}

function getContractNumber(orderId: string) {
  return `HP-${orderId.slice(0, 8).toUpperCase()}`;
}

function normalizePdfMode(mode: ContractPdfCreatePayload["mode"]): ExclusiveRightsRenderMode {
  return mode === "deferred" ? "deferred" : "partial";
}

async function renderPdfFromHtml(html: string): Promise<Uint8Array> {
  const { default: chromium } = await import("@sparticuz/chromium-min");
  const puppeteer = await import("puppeteer-core");
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      printBackground: true,
      format: "A4",
      margin: { top: "20mm", right: "14mm", bottom: "20mm", left: "14mm" },
    });
  } finally {
    await browser.close();
  }
}

export async function createRightsContractPdf(payload: ContractPdfCreatePayload) {
  const userId = await requireBuyerUserId();

  const order = await prisma.order.findFirst({ where: { id: payload.orderId, buyerUserId: userId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "paid" && order.status !== "pending_free_checkout") {
    throw new Error("ORDER_NOT_READY_FOR_RIGHTS_FORM");
  }

  const beat = await prisma.beat.findUnique({ where: { id: order.beatId }, select: { id: true, title: true } });
  if (!beat) throw new Error("BEAT_NOT_FOUND");

  const mode = normalizePdfMode(payload.mode);
  if (mode === "partial") {
    if (!payload.buyerFullName?.trim() || !payload.buyerCity?.trim() || !payload.buyerStageName?.trim()) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }
  }

  const seller = await getSellerIdentity();
  const issueDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const orderRow = toOrderRow(order);
  const currency = resolveOrderCurrency(orderRow);

  const html = renderExclusiveRightsRuTemplate({
    contract_number: getContractNumber(order.id),
    current_date: issueDate,
    beat_title: beat.title,
    price: formatMarketMoney(resolveOrderFinalPrice(orderRow), currency, currency === "RUB" ? "ru" : "en"),
    currency,
    ...seller,
    seller_signature_image: seller.seller_signature_image,
    mode,
    buyer_full_name: payload.buyerFullName?.trim() || order.buyerName || "",
    buyer_city: payload.buyerCity?.trim() || order.buyerCity || "",
    buyer_stage_name: payload.buyerStageName?.trim() || "",
    revealSellerPassport: true,
  });

  const pdfBuffer = await renderPdfFromHtml(html).catch(() => null);
  if (!pdfBuffer) throw new Error("PDF_RENDER_FAILED");

  const storage = new ContaboS3Storage(getS3Config());
  const key = `contracts/${order.id}/contract-${mode}-${Date.now()}.pdf`;

  try {
    await storage.putObject({
      visibility: "private",
      key,
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.byteLength,
    });
  } catch {
    throw new Error("PDF_UPLOAD_FAILED");
  }

  const rightsFormStatus = mode === "deferred" ? "deferred" : "completed_partial";

  try {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          rightsFormStatus,
          buyerFullName: mode === "partial" ? payload.buyerFullName?.trim() ?? null : null,
          buyerCity: mode === "partial" ? payload.buyerCity?.trim() ?? null : order.buyerCity,
          buyerStageName: mode === "partial" ? payload.buyerStageName?.trim() ?? null : null,
          contractPdfKey: key,
          contractTemplateType: mode,
        },
      }),
      prisma.contract.updateMany({ where: { orderId: order.id }, data: { pdfKey: key } }),
    ]);
  } catch {
    throw new Error("ORDER_UPDATE_FAILED");
  }

  let downloadUrl: string;
  try {
    const signed = await storage.createSignedDownloadUrl({ visibility: "private", key }, { expiresInSeconds: 60 * 60 });
    downloadUrl = signed.url;
  } catch {
    throw new Error("PDF_SIGN_URL_FAILED");
  }

  return { orderId: order.id, mode, storageKey: key, downloadUrl };
}
