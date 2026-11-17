import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const RESERVATION_MS = 7 * 24 * 60 * 60 * 1000;
export type OrderActor = { userId: string; role: "buyer" | "admin" };

export async function lockBeatRow(tx: Prisma.TransactionClient, beatId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM beats WHERE id = ${beatId}::uuid FOR UPDATE`;
  if (!rows.length) throw new Error("BEAT_NOT_FOUND");
}

export async function systemMessage(tx: Prisma.TransactionClient, orderId: string, text: string) {
  await tx.orderMessage.create({ data: { orderId, authorRole: "system", text } });
}

/** Expiry is enforced on reads and again under the beat row lock at every sale.
 * It does not depend on a scheduled job or an open browser. */
export async function releaseExpiredReservations() {
  await prisma.$executeRaw`
    WITH locked AS (
      SELECT id, reservation_order_id FROM beats WHERE reservation_expires_at <= CURRENT_TIMESTAMP
      ORDER BY id FOR UPDATE SKIP LOCKED
    ), released AS (
      UPDATE beats b SET status = CASE WHEN b.status = 'reserved' THEN 'available' ELSE b.status END,
        reservation_order_id = NULL, reservation_buyer_id = NULL, reservation_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      FROM locked l WHERE b.id = l.id
      RETURNING l.reservation_order_id AS order_id
    )
    INSERT INTO order_messages (order_id, author_role, text)
    SELECT order_id, 'system', 'Срок брони истёк.' FROM released WHERE order_id IS NOT NULL
  `;
}

export async function checkBeatForBuyer(tx: Prisma.TransactionClient, beatId: string, buyerId?: string | null, allowStaffHold = false) {
  await lockBeatRow(tx, beatId);
  let beat = await tx.beat.findUniqueOrThrow({ where: { id: beatId } });
  if (beat.reservationExpiresAt && beat.reservationExpiresAt <= new Date()) {
    const oldOrder = beat.reservationOrderId;
    beat = await tx.beat.update({ where: { id: beat.id }, data: {
      status: beat.status === "reserved" ? "available" : beat.status,
      reservationOrderId: null, reservationBuyerId: null, reservationExpiresAt: null,
    } });
    if (oldOrder) await systemMessage(tx, oldOrder, "Срок брони истёк.");
  }
  if (beat.status === "sold" || beat.status === "private") throw new Error("BEAT_NOT_AVAILABLE");
  if (beat.reservationOrderId && beat.reservationBuyerId !== buyerId) throw new Error("BEAT_RESERVED");
  if (beat.status === "reserved" && !beat.reservationOrderId && !allowStaffHold) throw new Error("BEAT_RESERVED");
  return beat;
}

export async function reserveOrderBeat(tx: Prisma.TransactionClient, orderId: string, actor: OrderActor) {
  const initial = await tx.order.findUnique({ where: { id: orderId } });
  if (!initial || (actor.role !== "admin" && initial.buyerUserId !== actor.userId)) throw new Error("ORDER_NOT_FOUND");
  const beat = await checkBeatForBuyer(tx, initial.beatId, initial.buyerUserId, actor.role === "admin");
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "draft" || !order.buyerUserId) throw new Error("ORDER_NOT_READY");
  if (beat.reservationOrderId === orderId) return beat.reservationExpiresAt!;
  if (beat.reservationOrderId) throw new Error("BEAT_RESERVED");
  if (await tx.order.findFirst({ where: { beatId: beat.id, status: "pending_payment", id: { not: orderId } }, select: { id: true } })) throw new Error("BEAT_PAYMENT_PENDING");
  const expiresAt = new Date(Date.now() + RESERVATION_MS);
  await tx.beat.update({ where: { id: beat.id }, data: { status: "reserved", reservationOrderId: orderId, reservationBuyerId: order.buyerUserId, reservationExpiresAt: expiresAt } });
  await systemMessage(tx, orderId, `Бит забронирован на 7 дней. Бронь действует до ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(expiresAt)} (Хельсинки).`);
  return expiresAt;
}

export async function cancelOrderReservation(tx: Prisma.TransactionClient, orderId: string, actor: OrderActor) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order || (actor.role !== "admin" && order.buyerUserId !== actor.userId)) throw new Error("ORDER_NOT_FOUND");
  await lockBeatRow(tx, order.beatId);
  const beat = await tx.beat.findUniqueOrThrow({ where: { id: order.beatId } });
  if (beat.reservationOrderId !== orderId) return;
  await tx.beat.update({ where: { id: beat.id }, data: { status: beat.status === "reserved" ? "available" : beat.status, reservationOrderId: null, reservationBuyerId: null, reservationExpiresAt: null } });
  await systemMessage(tx, orderId, "Бронь снята.");
}
