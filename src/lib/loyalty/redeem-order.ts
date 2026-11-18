import { preparedBeatDelivery } from "@/lib/delivery/beat-delivery";
import type { Prisma, PrismaClient } from "@prisma/client";
import { POINTS_PER_FREE_BEAT } from "@/lib/loyalty";
import { prisma } from "@/lib/db/client";
import { lockBeatRow } from "@/lib/orders/reservations";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";
import { ensureOrderLicense } from "@/lib/contracts/issue";

export async function spendOrderPoints(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.loyaltyPointsSpent === POINTS_PER_FREE_BEAT) return;
  if (!order.buyerUserId || order.discountPercent !== 100 || order.finalPrice !== 0 || order.basePrice <= 0) throw new Error("NOT_A_POINTS_ORDER");
  const debit = await tx.loyaltyPoint.updateMany({ where: { userId: order.buyerUserId, points: { gte: POINTS_PER_FREE_BEAT } }, data: { points: { decrement: POINTS_PER_FREE_BEAT } } });
  if (!debit.count) throw new Error("INSUFFICIENT_POINTS");
  await tx.order.update({ where: { id: orderId }, data: { loyaltyPointsSpent: POINTS_PER_FREE_BEAT } });
  const buyer = await tx.user.findUniqueOrThrow({ where: { id: order.buyerUserId }, select: { email: true } });
  const beat = await tx.beat.findUniqueOrThrow({ where: { id: order.beatId }, select: { title: true } });
  await tx.beatPurchase.create({ data: { orderId, beatId: order.beatId, beatTitle: beat.title, userId: order.buyerUserId, userEmail: buyer.email, basePriceUsd: order.basePriceUsd, finalPriceUsd: 0, discountPercent: 100, pointsEarned: 0 } });
}

export async function redeemBeatOrder(orderId: string, buyerId: string, db: PrismaClient = prisma) {
  await db.$transaction(async (tx) => {
    const initial = await tx.order.findFirst({ where: { id: orderId, buyerUserId: buyerId } });
    if (!initial) throw new Error("ORDER_NOT_FOUND");
    await lockBeatRow(tx, initial.beatId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { contract: true } });
    if (order.status === "paid" && order.loyaltyPointsSpent === POINTS_PER_FREE_BEAT) return;
    if (order.status !== "draft" || !order.termsAcceptedAt || !order.personalDataConsentAt || !order.contract?.htmlSnapshot.startsWith("<!doctype html>")) throw new Error("ORDER_NOT_READY");
    const delivery = await preparedBeatDelivery(tx, order.beatId);
    await spendOrderPoints(tx, orderId);
    if (!await lockBeatForExclusiveSale(tx, order.beatId, buyerId)) throw new Error("BEAT_NOT_AVAILABLE");
    await tx.order.update({ where: { id: orderId }, data: { status: "paid", paidAt: new Date(), paymentProvider: "internal", ...delivery } });
    await tx.orderMessage.create({ data: { orderId, authorRole: "system", text: "Бит получен за 100 поинтов. Лицензия доступна в заказе и профиле." } });
  });
  try { const pdf = await ensureOrderLicense(orderId); return { orderId, pdfReady: true, downloadUrl: pdf.downloadUrl }; }
  catch { return { orderId, pdfReady: false, downloadUrl: null }; }
}
