import type { Prisma } from "@prisma/client";
import { checkBeatForBuyer } from "@/lib/orders/reservations";

export async function lockBeatForExclusiveSale(tx: Prisma.TransactionClient, beatId: string, buyerUserId?: string | null, paymentOrderId?: string) {
  try { await checkBeatForBuyer(tx, beatId, buyerUserId, true, paymentOrderId); }
  catch (error) {
    if (error instanceof Error && ["BEAT_NOT_AVAILABLE", "BEAT_RESERVED", "BEAT_PAYMENT_PENDING"].includes(error.message)) return false;
    throw error;
  }
  await tx.beat.update({ where: { id: beatId }, data: { status: "sold", availableForDownload: false, reservationOrderId: null, reservationBuyerId: null, reservationExpiresAt: null } });
  return true;
}
