import { prisma } from "@/lib/db/client";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { createStoredContractPdf, getStoredContractPdfUrl } from "@/lib/contracts/pdf-storage";
import { renderContractHtml } from "@/lib/contracts/preview";
import { toOrderRow } from "@/lib/orders/order-row";

/** A retry reuses the frozen snapshot and the issued PDF. No browser session is
 * needed here: callers must authorize the order or verify a payment webhook. */
export async function ensureOrderLicense(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId }, include: { beat: { select: { title: true, caseNumber: true } }, contract: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.licenseType !== "exclusive") throw new Error("LICENSE_TYPE_NOT_SUPPORTED");
  if (order.status !== "paid" && order.status !== "pending_free_checkout") throw new Error("ORDER_NOT_READY_FOR_RIGHTS_FORM");
  if (order.contractPdfKey) {
    return { key: order.contractPdfKey, downloadUrl: await getStoredContractPdfUrl(order.contractPdfKey, orderId) };
  }

  let snapshot = order.contract?.htmlSnapshot;
  if (!snapshot?.includes("<!doctype html>")) {
    // Legacy/manual orders without a usable checkout snapshot can be repaired.
    await getSellerIdentity();
    const html = await renderContractHtml(toOrderRow(order), order.beat);
    await prisma.contract.upsert({
      where: { orderId },
      create: { orderId, beatId: order.beatId, buyerEmail: order.buyerEmail, htmlSnapshot: html },
      update: {},
    });
    await prisma.contract.updateMany({
      where: { orderId, htmlSnapshot: { not: { startsWith: "<!doctype html>" } } }, data: { htmlSnapshot: html },
    });
    snapshot = (await prisma.contract.findUniqueOrThrow({ where: { orderId } })).htmlSnapshot;
  }
  const pdf = await createStoredContractPdf(orderId, snapshot, "license");
  // Concurrent webhook/download retries may render twice, but publish one key
  // atomically to both records. Existing documents are never replaced.
  const key = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, contractPdfKey: null, status: { in: ["paid", "pending_free_checkout"] } },
      data: { contractPdfKey: pdf.key, contractTemplateType: "license_maker_bilingual", rightsFormStatus: "completed_partial" },
    });
    if (updated.count) {
      await tx.contract.update({ where: { orderId }, data: { pdfKey: pdf.key } });
      return pdf.key;
    }
    const saved = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { contractPdfKey: true } });
    if (!saved.contractPdfKey) throw new Error("ORDER_UPDATE_FAILED");
    return saved.contractPdfKey;
  });
  return { key, downloadUrl: key === pdf.key ? pdf.downloadUrl : await getStoredContractPdfUrl(key, orderId) };
}
