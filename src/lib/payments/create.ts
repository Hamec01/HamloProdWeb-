import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { createLavaInvoice } from "@/lib/payments/lava";
import { toOrderRow, type OrderRow } from "@/lib/orders/order-row";

type BeatPaymentRow = { id: string; title: string; slug: string; price_rub: number | null; price_usd: number };
type ContractPaymentRow = { id: string; html_snapshot: string };

type FreeOrderResult = { kind: "free"; orderId: string; status: "pending_free_checkout"; paymentUrl: null };
type PaidOrderResult = { kind: "paid"; orderId: string; status: "pending_payment"; paymentUrl: string };
export type PaymentPreparationResult = FreeOrderResult | PaidOrderResult;

function clampDiscountPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function recalculateFinalAmount(basePrice: number, discountPercent: number) {
  return Math.max(0, Math.round((basePrice * (100 - clampDiscountPercent(discountPercent))) / 100));
}

async function requireBuyerUserId(): Promise<string> {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) throw new Error("UNAUTHORIZED");
  return session.userId;
}

export async function getOrderForPayment(orderId: string): Promise<{
  order: OrderRow;
  beat: BeatPaymentRow;
  contract: ContractPaymentRow | null;
  contractSnapshotExists: boolean;
}> {
  const userId = await requireBuyerUserId();

  const order = await prisma.order.findFirst({ where: { id: orderId, buyerUserId: userId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const [beat, contract] = await Promise.all([
    prisma.beat.findUnique({ where: { id: order.beatId }, select: { id: true, title: true, slug: true, priceRub: true, priceUsd: true } }),
    prisma.contract.findUnique({ where: { orderId }, select: { id: true, htmlSnapshot: true } }),
  ]);

  if (!beat) throw new Error("BEAT_NOT_FOUND");

  const contractRow: ContractPaymentRow | null = contract ? { id: contract.id, html_snapshot: contract.htmlSnapshot } : null;

  return {
    order: toOrderRow(order),
    beat: { id: beat.id, title: beat.title, slug: beat.slug, price_rub: beat.priceRub, price_usd: beat.priceUsd },
    contract: contractRow,
    contractSnapshotExists: Boolean(contractRow?.html_snapshot?.trim()),
  };
}

async function persistRecalculatedOrderAmount(orderId: string, basePrice: number, finalPrice: number, currency: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { basePrice, finalPrice, basePriceUsd: basePrice, finalPriceUsd: finalPrice, currency },
    });
  } catch {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function markFreeOrderPending(orderId: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "pending_free_checkout", paymentProvider: "internal", provider: "internal", paymentExternalId: null, paymentUrl: null },
    });
  } catch {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function markPaidOrderPending(orderId: string, externalId: string | null, paymentUrl: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "pending_payment", paymentProvider: "lava", provider: "lava", paymentExternalId: externalId, paymentUrl },
    });
  } catch {
    throw new Error("ORDER_UPDATE_FAILED");
  }
}

async function createLavaPayment(order: OrderRow, beat: BeatPaymentRow): Promise<{ paymentUrl: string; externalId: string | null }> {
  const apiBaseUrl = process.env.LAVA_API_BASE_URL?.trim();
  const apiKey = process.env.LAVA_API_KEY?.trim();
  if (!apiKey) throw new Error("LAVA_NOT_CONFIGURED");

  const lava = await createLavaInvoice({
    apiBaseUrl,
    apiKey,
    payload: {
      amount: resolveOrderFinalPrice(order),
      currency: "RUB",
      description: `Beat purchase: ${beat.title}`,
      external_id: order.id,
      success_url: "https://hamloprod.org/payment/success",
      fail_url: "https://hamloprod.org/payment/fail",
    },
  });

  if (!lava.ok) {
    console.error("[lava] invoice create failed", { httpStatus: lava.httpStatus, orderId: order.id });
    throw new Error("LAVA_REQUEST_FAILED");
  }

  return { paymentUrl: lava.paymentUrl, externalId: lava.externalId };
}

export async function preparePaymentCreation(orderId: string): Promise<PaymentPreparationResult> {
  const { order, beat, contractSnapshotExists } = await getOrderForPayment(orderId);

  if (order.status !== "draft") throw new Error("ORDER_NOT_DRAFT");
  if (!contractSnapshotExists) throw new Error("CONTRACT_SNAPSHOT_MISSING");
  if (order.market !== "ru") throw new Error("MARKET_NOT_SUPPORTED");
  if (order.provider !== "lava") throw new Error("PROVIDER_NOT_SUPPORTED");

  const currentBasePrice = resolveOrderBasePrice(order);
  const currentFinalPrice = resolveOrderFinalPrice(order);
  const currentCurrency = resolveOrderCurrency(order);
  const marketBasePrice = beat.price_rub ?? currentBasePrice;
  const recalculatedFinalAmount = recalculateFinalAmount(marketBasePrice, order.discount_percent);

  if (marketBasePrice !== currentBasePrice || recalculatedFinalAmount !== currentFinalPrice || currentCurrency !== "RUB") {
    await persistRecalculatedOrderAmount(order.id, marketBasePrice, recalculatedFinalAmount, "RUB");
  }

  if (recalculatedFinalAmount === 0) {
    await markFreeOrderPending(order.id);
    return { kind: "free", orderId: order.id, status: "pending_free_checkout", paymentUrl: null };
  }

  const lavaPayment = await createLavaPayment(
    { ...order, final_price: recalculatedFinalAmount, final_price_usd: recalculatedFinalAmount },
    beat,
  );

  await markPaidOrderPending(order.id, lavaPayment.externalId, lavaPayment.paymentUrl);
  return { kind: "paid", orderId: order.id, status: "pending_payment", paymentUrl: lavaPayment.paymentUrl };
}
