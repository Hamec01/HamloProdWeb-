import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { renderExclusiveRightsRuTemplate } from "@/lib/contracts/templates/exclusive-rights-ru";
import { formatMarketMoney, type CurrencyCode } from "@/lib/market";
import { toContractRow, toOrderRow, type ContractRow, type OrderRow } from "@/lib/orders/order-row";

const CONTRACT_DRAFT_PLACEHOLDER = "<p>Contract draft placeholder.</p>";

export type ContractTemplateName = "exclusive-rights-ru";

function getContractNumber(orderId: string) {
  return `HP-${orderId.slice(0, 8).toUpperCase()}`;
}

function getCurrentDate() {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

export function resolveContractTemplate(_: "ru" | "en"): ContractTemplateName {
  return "exclusive-rights-ru";
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

export async function getOrderForPreview(orderId: string): Promise<{ order: OrderRow; beat: { id: string; title: string; slug: string } }> {
  const userId = await requireBuyerUserId();

  const order = await prisma.order.findFirst({ where: { id: orderId, buyerUserId: userId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const beat = await prisma.beat.findUnique({ where: { id: order.beatId }, select: { id: true, title: true, slug: true } });
  if (!beat) throw new Error("BEAT_NOT_FOUND");

  return { order: toOrderRow(order), beat };
}

export async function getOrCreateContractDraft(orderId: string): Promise<ContractRow> {
  await requireBuyerUserId();

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, beatId: true, buyerEmail: true } });
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
  await requireBuyerUserId();
  const contract = await prisma.contract.findUnique({ where: { orderId } });
  return contract ? toContractRow(contract) : null;
}

export async function renderContractHtml(order: OrderRow, beat: { title: string }, _: ContractTemplateName) {
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

export async function saveContractSnapshot(contractId: string, html: string): Promise<ContractRow> {
  await requireBuyerUserId();
  try {
    const saved = await prisma.contract.update({
      where: { id: contractId },
      data: { htmlSnapshot: html, issuedAt: new Date() },
    });
    return toContractRow(saved);
  } catch {
    throw new Error("CONTRACT_SAVE_FAILED");
  }
}

export async function generateAndSaveContractSnapshot(orderId: string) {
  const [{ order, beat }, contract] = await Promise.all([getOrderForPreview(orderId), getOrCreateContractDraft(orderId)]);

  const template = resolveContractTemplate(order.contract_language);
  const html = await renderContractHtml(order, beat, template);
  const saved = await saveContractSnapshot(contract.id, html);

  return { order, beat, contract: saved, html, previewUrl: `/checkout/preview/${order.id}` };
}
