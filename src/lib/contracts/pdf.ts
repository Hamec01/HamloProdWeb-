import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import type { ContractPdfCreatePayload } from "@/lib/validations/rights-form";

/** Backwards-compatible endpoint for older profile links. Buyer details and the
 * accepted contract are frozen at checkout, so a PDF request cannot rewrite them. */
export async function createRightsContractPdf(payload: ContractPdfCreatePayload) {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) throw new Error("UNAUTHORIZED");
  const order = await prisma.order.findFirst({ where: { id: payload.orderId, buyerUserId: session.userId }, select: { id: true } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const pdf = await ensureOrderLicense(order.id);
  return { orderId: order.id, mode: "partial" as const, storageKey: pdf.key, downloadUrl: pdf.downloadUrl };
}
