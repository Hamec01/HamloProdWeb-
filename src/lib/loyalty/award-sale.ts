import { POINTS_PER_PURCHASE } from "@/lib/loyalty";
import type { Prisma } from "@prisma/client";

/** Claim the order and increment its buyer's balance in the sale transaction.
 * Rendering/retrying a PDF never calls this function. */
export async function awardSalePoints(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { beat: { select: { title: true } }, buyerUser: { select: { email: true } } } });
  if (!order || order.finalPrice <= 0) return false;
  if (!order.buyerUserId || !order.buyerUser || !["paid", "pending_free_checkout"].includes(order.status)) return false;
  const claimed = await tx.order.updateMany({
    where: { id: orderId, loyaltyAwardedAt: null }, data: { loyaltyAwardedAt: new Date() },
  });
  if (!claimed.count) return false;
  // Imported purchases may already be represented in the existing loyalty ledger.
  if (await tx.beatPurchase.findFirst({ where: { orderId }, select: { id: true } })) return false;
  await tx.beatPurchase.create({ data: {
    orderId, beatId: order.beatId, beatTitle: order.beat.title,
    userId: order.buyerUserId, userEmail: order.buyerUser.email,
    basePriceUsd: order.basePriceUsd, finalPriceUsd: order.finalPriceUsd,
    discountPercent: order.discountPercent, pointsEarned: POINTS_PER_PURCHASE,
  } });
  await tx.loyaltyPoint.upsert({
    where: { userId: order.buyerUserId },
    create: { userId: order.buyerUserId, userEmail: order.buyerUser.email, points: POINTS_PER_PURCHASE },
    update: { userEmail: order.buyerUser.email, points: { increment: POINTS_PER_PURCHASE } },
  });
  return true;
}
