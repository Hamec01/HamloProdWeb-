import { checkBeatForBuyer } from "@/lib/orders/reservations";
import { redeemBeatOrder } from "@/lib/loyalty/redeem-order";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { createLavaInvoice } from "@/lib/payments/lava";
import { startStripeCheckout } from "@/lib/payments/stripe-checkout";
import { isBeatStripeReady } from "@/lib/checkout/config";
import { toOrderRow, type OrderRow } from "@/lib/orders/order-row";

type BeatPaymentRow = { id: string; title: string; slug: string; price_rub: number | null; price_usd: number };
type ContractPaymentRow = { id: string; html_snapshot: string };

type FreeOrderResult = { kind: "free"; orderId: string; status: "pending_free_checkout" | "paid"; paymentUrl: null };
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

async function markPaidOrderPending(orderId: string, provider: "lava" | "stripe", externalId: string, paymentUrl: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { beatId: true, buyerUserId: true } });
      await checkBeatForBuyer(tx, order.beatId, order.buyerUserId);
      const updated = await tx.order.updateMany({ where: { id: orderId, status: "draft" }, data: { status: "pending_payment", paymentProvider: provider, provider, paymentExternalId: externalId, paymentUrl } });
      if (updated.count !== 1) throw new Error("ORDER_NOT_DRAFT");
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_DRAFT") throw error;
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
  if (order.status === "pending_free_checkout") {
    await ensureOrderLicense(order.id);
    return { kind: "free", orderId: order.id, status: "pending_free_checkout", paymentUrl: null };
  }

  if (order.provider === "stripe" && resolveOrderFinalPrice(order) > 0) {
    if (!isBeatStripeReady()) throw new Error("STRIPE_NOT_CONFIGURED");
    return startStripeCheckout(order.id, await requireBuyerUserId());
  }
  if (order.status !== "draft") throw new Error("ORDER_NOT_DRAFT");
  if (!contractSnapshotExists) throw new Error("CONTRACT_SNAPSHOT_MISSING");
  if (!order.terms_accepted_at || !order.personal_data_consent_at) throw new Error("CHECKOUT_ACCEPTANCE_MISSING");
  if (order.market !== "ru" && order.market !== "global") throw new Error("MARKET_NOT_SUPPORTED");
  if (order.final_price === 0 && order.discount_percent === 100) {
    const userId = await requireBuyerUserId();
    await redeemBeatOrder(order.id, userId);
    return { kind: "free", orderId: order.id, status: "paid", paymentUrl: null };
  }
  if ((order.market === "ru" && order.provider !== "lava") || (order.market === "global" && order.provider !== "stripe")) {
    throw new Error("PROVIDER_NOT_SUPPORTED");
  }

  const currentBasePrice = resolveOrderBasePrice(order);
  const currentFinalPrice = resolveOrderFinalPrice(order);
  const currentCurrency = resolveOrderCurrency(order);
  const currency = order.market === "ru" ? "RUB" : "USD";
  const marketBasePrice = order.market === "ru" ? beat.price_rub ?? currentBasePrice : beat.price_usd;
  const recalculatedFinalAmount = recalculateFinalAmount(marketBasePrice, order.discount_percent);

  if (marketBasePrice !== currentBasePrice || recalculatedFinalAmount !== currentFinalPrice || currentCurrency !== currency) {
    throw new Error("ORDER_PRICE_CHANGED");
  }

  await prisma.$transaction((tx) => checkBeatForBuyer(tx, order.beat_id, order.buyer_user_id));
  const paymentOrder = { ...order, final_price: recalculatedFinalAmount, final_price_usd: recalculatedFinalAmount };
  if (order.market !== "ru") throw new Error("PROVIDER_NOT_SUPPORTED");
  const payment = await createLavaPayment(paymentOrder, beat);

  if (!payment.externalId) throw new Error(order.market === "ru" ? "LAVA_RESPONSE_INVALID" : "STRIPE_REQUEST_FAILED");
  await markPaidOrderPending(order.id, order.market === "ru" ? "lava" : "stripe", payment.externalId, payment.paymentUrl);
  return { kind: "paid", orderId: order.id, status: "pending_payment", paymentUrl: payment.paymentUrl };
}
