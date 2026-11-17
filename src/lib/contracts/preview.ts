import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { renderExclusiveLicenseBilingual } from "@/lib/contracts/templates/exclusive-license-bilingual";
import { formatMarketMoney, type CurrencyCode } from "@/lib/market";
import { toContractRow, toOrderRow, type ContractRow, type OrderRow } from "@/lib/orders/order-row";

const CONTRACT_DRAFT_PLACEHOLDER = "<p>Contract draft placeholder.</p>";

function getContractNumber(orderId: string) {
  return `HP-${orderId.toUpperCase()}`;
}

function resolvePreviewCurrency(order: Pick<OrderRow, "currency" | "market" | "contract_language">): CurrencyCode {
  const normalized = order.currency?.trim().toUpperCase();
  if (normalized === "RUB" || normalized === "USD") return normalized;
  if (order.market === "ru" || order.contract_language === "ru") return "RUB";
  return "USD";
}

function resolvePreviewAmount(order: Pick<OrderRow, "final_price" | "base_price" | "final_price_usd" | "base_price_usd">) {
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

  if (amount === null || !Number.isFinite(amount)) throw new Error("ORDER_FINAL_PRICE_MISSING");
  return Math.max(0, amount);
}

function validatePreviewPayload(order: OrderRow, beat: { title: string }) {
  if (!beat.title?.trim()) throw new Error("BEAT_TITLE_MISSING");
  if (!order.buyer_email?.trim()) throw new Error("BUYER_EMAIL_MISSING");
}

async function requireBuyerUserId(): Promise<string> {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) throw new Error("UNAUTHORIZED");
  return session.userId;
}

export async function getOrderForPreview(orderId: string): Promise<{ order: OrderRow; beat: { id: string; title: string; slug: string; caseNumber: string } }> {
  const userId = await requireBuyerUserId();

  const order = await prisma.order.findFirst({ where: { id: orderId, buyerUserId: userId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const beat = await prisma.beat.findUnique({ where: { id: order.beatId }, select: { id: true, title: true, slug: true, caseNumber: true } });
  if (!beat) throw new Error("BEAT_NOT_FOUND");

  return { order: toOrderRow(order), beat };
}

export async function getOrCreateContractDraft(orderId: string): Promise<ContractRow> {
  const userId = await requireBuyerUserId();

  const order = await prisma.order.findFirst({ where: { id: orderId, buyerUserId: userId }, select: { id: true, beatId: true, buyerEmail: true } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const existing = await prisma.contract.findUnique({ where: { orderId } });
  if (existing) return toContractRow(existing);

  try {
    const inserted = await prisma.contract.create({
      data: { orderId: order.id, beatId: order.beatId, buyerEmail: order.buyerEmail, htmlSnapshot: CONTRACT_DRAFT_PLACEHOLDER },
    });
    return toContractRow(inserted);
  } catch {
    const raced = await prisma.contract.findUnique({ where: { orderId } });
    if (raced) return toContractRow(raced);
    throw new Error("CONTRACT_CREATE_FAILED");
  }
}

export async function getContractByOrderId(orderId: string): Promise<ContractRow | null> {
  const userId = await requireBuyerUserId();
  const contract = await prisma.contract.findFirst({ where: { orderId, order: { buyerUserId: userId } } });
  return contract ? toContractRow(contract) : null;
}

export async function renderContractHtml(order: OrderRow, beat: { title: string; caseNumber?: string }) {
  validatePreviewPayload(order, beat);

  const currency = resolvePreviewCurrency(order);
  const finalPrice = resolvePreviewAmount(order);

  const [seller, date_en] = await Promise.all([
    getSellerIdentity(),
    new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(order.created_at)),
  ]);
  return renderExclusiveLicenseBilingual({
    contract_number: getContractNumber(order.id),
    date_ru: new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC" }).format(new Date(order.created_at)),
    date_en,
    beat_title: beat.title,
    beat_catalog_number: beat.caseNumber || "",
    canonical_beat_id: order.beat_id,
    price: formatMarketMoney(finalPrice, currency, currency === "RUB" ? "ru" : "en"),
    currency,
    ...seller,
    buyer_full_name: order.buyer_full_name ?? order.buyer_name,
    buyer_city: order.buyer_city,
    buyer_country: order.buyer_country,
    buyer_email: order.buyer_email,
    buyer_stage_name: order.buyer_stage_name,
    buyer_acceptance_at: order.terms_accepted_at,
    payment_method: order.provider || "Online payment",
    mode: "partial",
  });
}

export async function saveContractSnapshot(contractId: string, html: string): Promise<ContractRow> {
  const userId = await requireBuyerUserId();
  try {
    const saved = await prisma.contract.update({
      where: { id: contractId, order: { buyerUserId: userId, status: "draft" } },
      data: { htmlSnapshot: html, issuedAt: new Date() },
    });
    return toContractRow(saved);
  } catch {
    throw new Error("CONTRACT_SAVE_FAILED");
  }
}

export async function generateAndSaveContractSnapshot(orderId: string) {
  const [{ order, beat }, contract] = await Promise.all([getOrderForPreview(orderId), getOrCreateContractDraft(orderId)]);

  if (order.status !== "draft") {
    if (contract.html_snapshot === CONTRACT_DRAFT_PLACEHOLDER) throw new Error("CONTRACT_SNAPSHOT_MISSING");
    return { order, beat, contract, html: contract.html_snapshot, previewUrl: `/checkout/preview/${order.id}` };
  }
  const html = await renderContractHtml(order, beat);
  const saved = await saveContractSnapshot(contract.id, html);

  return { order, beat, contract: saved, html, previewUrl: `/checkout/preview/${order.id}` };
}
