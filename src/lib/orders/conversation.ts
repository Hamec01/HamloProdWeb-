import { isBeatStripeReady } from "@/lib/checkout/config";
import { prisma } from "@/lib/db/client";
import type { OrderActor } from "./reservations";
import { releaseExpiredReservations } from "./reservations";

export async function accessibleOrder(orderId: string, actor: OrderActor) {
  const order = await prisma.order.findFirst({ where: { id: orderId, ...(actor.role === "buyer" ? { buyerUserId: actor.userId } : {}) }, include: { beat: { include: { delivery: { select: { beatId: true } } } }, contract: { select: { htmlSnapshot: true } }, buyerUser: { select: { loyalty: { select: { points: true } } } } } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  return order;
}

export async function getConversation(orderId: string, actor: OrderActor, before?: string) {
  await releaseExpiredReservations();
  const order = await accessibleOrder(orderId, actor);
  const cursor = before ? await prisma.orderMessage.findFirst({ where: { id: before, orderId }, select: { id: true } }) : null;
  if (before && !cursor) throw new Error("BAD_CURSOR");
  const rows = await prisma.orderMessage.findMany({ where: { orderId }, ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
  const messages = rows.slice(0, 50).reverse();
  const newest = messages.at(-1)?.createdAt;
  if (newest) {
    const field = actor.role === "admin" ? "adminLastReadAt" : "buyerLastReadAt";
    await prisma.order.updateMany({ where: { id: orderId, OR: [{ [field]: null }, { [field]: { lt: newest } }] }, data: { [field]: newest } });
  }
  return {
    order: { id: order.id, beatId: order.beatId, beatTitle: order.beat.title, beatSlug: order.beat.slug, buyerName: order.buyerName, buyerEmail: order.buyerEmail, status: order.status, provider: order.provider, stripeAvailable: isBeatStripeReady() && order.beat.priceUsd > 0 && Boolean(order.beat.delivery), paymentUrl: actor.role === "buyer" && order.status === "pending_payment" && order.provider === "stripe" ? order.paymentUrl : null, amount: order.finalPrice, currency: order.currency, hasContract: Boolean(order.termsAcceptedAt && order.personalDataConsentAt && order.contract?.htmlSnapshot.startsWith("<!doctype html>")), points: order.buyerUser?.loyalty?.points ?? 0, redeemable: order.basePrice > 0 && order.finalPrice === 0 && order.discountPercent === 100, pointsSpent: order.loyaltyPointsSpent, deliveryMp3Url: ["paid", "pending_free_checkout"].includes(order.status) ? order.deliveryMp3Url : null, reservationExpiresAt: order.beat.reservationExpiresAt?.toISOString() ?? null, reservationIsOurs: order.beat.reservationOrderId === orderId, sold: order.beat.status === "sold" },
    messages: messages.map((message) => ({ id: message.id, role: message.authorRole, text: message.text, createdAt: message.createdAt.toISOString() })),
    hasMore: rows.length > 50,
  };
}

export async function sendOrderMessage(orderId: string, actor: OrderActor, text: string, clientMessageId: string) {
  await accessibleOrder(orderId, actor);
  return prisma.orderMessage.upsert({ where: { orderId_authorUserId_clientMessageId: { orderId, authorUserId: actor.userId, clientMessageId } }, create: { orderId, authorUserId: actor.userId, authorRole: actor.role, text, clientMessageId }, update: {}, select: { id: true } });
}
