import { awardSalePoints } from "@/lib/loyalty/award-sale";
import { prisma } from "@/lib/db/client";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";
import { ensureOrderLicense } from "@/lib/contracts/issue";

/** Confirms a buyer-submitted contact order after the administrator receives
 * payment. Reuses the exact buyer details and accepted checkout snapshot. */
export async function confirmManualOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, provider: "contact" }, include: { contract: true } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status === "paid") { await awardSalePoints(tx, orderId); return; }
    if (order.licenseType !== "exclusive" || order.status !== "draft" || !order.termsAcceptedAt || !order.personalDataConsentAt || !order.contract?.htmlSnapshot.startsWith("<!doctype html>")) throw new Error("ORDER_NOT_READY");
    const updated = await tx.order.updateMany({ where: { id: orderId, status: "draft" }, data: { status: "paid", paidAt: new Date(), paymentProvider: "contact" } });
    if (!updated.count) return; // A simultaneous confirmation has already committed.
    if (!await lockBeatForExclusiveSale(tx, order.beatId)) throw new Error("BEAT_NOT_AVAILABLE");
    await awardSalePoints(tx, orderId);
  });
  try {
    const pdf = await ensureOrderLicense(orderId);
    return { orderId, pdfReady: true, downloadUrl: pdf.downloadUrl };
  } catch {
    return { orderId, pdfReady: false, downloadUrl: null };
  }
}
