import { awardSalePoints } from "@/lib/loyalty/award-sale";
import { spendOrderPoints } from "@/lib/loyalty/redeem-order";
import { lockBeatRow, systemMessage } from "@/lib/orders/reservations";
import { prisma } from "@/lib/db/client";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";
import { ensureOrderLicense } from "@/lib/contracts/issue";

/** Confirms a buyer-submitted contact order after the administrator receives
 * payment. Reuses the exact buyer details and accepted checkout snapshot. */
export async function confirmManualOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const initial = await tx.order.findFirst({ where: { id: orderId, provider: "contact" } });
    if (!initial) throw new Error("ORDER_NOT_FOUND");
    await lockBeatRow(tx, initial.beatId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { contract: true } });
    if (order.status === "paid") { await awardSalePoints(tx, orderId); return; }
    if (order.licenseType !== "exclusive" || order.status !== "draft" || !order.termsAcceptedAt || !order.personalDataConsentAt || !order.contract?.htmlSnapshot.startsWith("<!doctype html>")) throw new Error("ORDER_NOT_READY");
    if (order.discountPercent === 100 && order.finalPrice === 0) await spendOrderPoints(tx, orderId);
    if (!await lockBeatForExclusiveSale(tx, order.beatId, order.buyerUserId)) throw new Error("BEAT_NOT_AVAILABLE");
    const updated = await tx.order.updateMany({ where: { id: orderId, status: "draft" }, data: { status: "paid", paidAt: new Date(), paymentProvider: "contact" } });
    if (!updated.count) return; // A simultaneous confirmation has already committed.
    await awardSalePoints(tx, orderId);
    await systemMessage(tx, orderId, "Продавец подтвердил получение оплаты. Лицензия доступна в заказе и профиле.");
  });
  try {
    const pdf = await ensureOrderLicense(orderId);
    return { orderId, pdfReady: true, downloadUrl: pdf.downloadUrl };
  } catch {
    return { orderId, pdfReady: false, downloadUrl: null };
  }
}
