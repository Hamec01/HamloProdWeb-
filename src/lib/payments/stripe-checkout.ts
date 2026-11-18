import { preparedBeatDelivery } from "@/lib/delivery/beat-delivery";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { checkBeatForBuyer, lockBeatRow } from "@/lib/orders/reservations";
import { createStripeCheckoutSession, retrieveStripeCheckoutSession } from "./stripe";

/** Release only after Stripe confirms expiry, even if its expiry webhook was
 * missed. A local clock deadline alone must never release a possibly paid beat. */
export async function refreshExpiredStripeHold(beatId: string, db: PrismaClient = prisma, retrieve = retrieveStripeCheckoutSession) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return;
  const pending = await db.order.findFirst({ where: { beatId, provider: "stripe", status: "pending_payment", expiresAt: { lte: new Date() }, paymentExternalId: { not: null } }, select: { id: true, paymentExternalId: true } });
  if (!pending?.paymentExternalId) return;
  try {
    const session = await retrieve(key, pending.paymentExternalId);
    const metadata = session.metadata as { orderId?: unknown } | undefined;
    if (session.id !== pending.paymentExternalId || metadata?.orderId !== pending.id || session.status !== "expired" || session.payment_status !== "unpaid") return;
    await db.$transaction(async (tx) => {
      await lockBeatRow(tx, beatId);
      await tx.order.updateMany({ where: { id: pending.id, provider: "stripe", paymentExternalId: pending.paymentExternalId, status: "pending_payment" }, data: { status: "failed" } });
    });
  } catch { /* Keep inventory claimed while Stripe cannot confirm its state. */ }
}

/** Claim inventory before calling Stripe. An uncertain network result retains the
 * claim; retry uses the same immutable order/expiry and Stripe idempotency key. */
export async function startStripeCheckout(orderId: string, buyerId: string, db: PrismaClient = prisma, createSession = createStripeCheckoutSession) {
  const initial = await db.order.findFirst({ where: { id: orderId, buyerUserId: buyerId }, select: { beatId: true } });
  if (!initial) throw new Error("ORDER_NOT_FOUND");
  await refreshExpiredStripeHold(initial.beatId, db);
  const claim = await db.$transaction(async (tx) => {
    const initial = await tx.order.findFirst({ where: { id: orderId, buyerUserId: buyerId } });
    if (!initial) throw new Error("ORDER_NOT_FOUND");
    await lockBeatRow(tx, initial.beatId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { contract: true, beat: { include: { delivery: true } } } });
    if (order.provider !== "stripe" || order.currency !== "USD" || order.market !== "global") throw new Error("PROVIDER_NOT_SUPPORTED");
    if (order.status === "pending_payment") {
      if (order.paymentUrl && order.paymentExternalId) return { order, reuse: true };
      if (!order.expiresAt || order.expiresAt.getTime() <= Date.now() + 31 * 60 * 1000) throw new Error("STRIPE_CHECKOUT_RECOVERY_REQUIRED");
      return { order, reuse: false };
    }
    if (order.status !== "draft") throw new Error("ORDER_NOT_DRAFT");
    await checkBeatForBuyer(tx, order.beatId, buyerId, false, order.id);
    if (!order.termsAcceptedAt || !order.personalDataConsentAt || !order.contract?.htmlSnapshot.startsWith("<!doctype html>")) throw new Error("CHECKOUT_ACCEPTANCE_MISSING");
    const delivery = await preparedBeatDelivery(tx, order.beatId);
    if (order.finalPrice < 1 || order.discountPercent !== 0 || order.finalPrice !== order.basePrice || order.finalPrice !== order.beat.priceUsd) throw new Error("ORDER_PRICE_CHANGED");
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 60 * 60 * 1000);
    const pending = await tx.order.update({ where: { id: orderId }, data: { status: "pending_payment", paymentProvider: "stripe", expiresAt, ...delivery } });
    return { order: { ...order, ...pending }, reuse: false };
  });
  if (claim.reuse) return { kind: "paid" as const, orderId, status: "pending_payment" as const, paymentUrl: claim.order.paymentUrl! };
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("STRIPE_NOT_CONFIGURED");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://hamloprod.org").replace(/\/$/, "");
  const session = await createSession({ secretKey, orderId, beatTitle: claim.order.beat.title, buyerEmail: claim.order.buyerEmail, amountUsd: claim.order.finalPrice, successUrl: `${siteUrl}/orders/${orderId}?payment=success`, cancelUrl: `${siteUrl}/orders/${orderId}?payment=cancelled`, expiresAt: Math.floor(claim.order.expiresAt!.getTime() / 1000) });
  const saved = await db.order.updateMany({ where: { id: orderId, buyerUserId: buyerId, provider: "stripe", status: "pending_payment", OR: [{ paymentExternalId: null }, { paymentExternalId: session.sessionId }] }, data: { paymentExternalId: session.sessionId, paymentUrl: session.paymentUrl } });
  if (!saved.count) throw new Error("ORDER_UPDATE_FAILED");
  return { kind: "paid" as const, orderId, status: "pending_payment" as const, paymentUrl: session.paymentUrl };
}
