import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const beatDeliverySchema = z.object({ url: z.string().trim().max(4000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    const filePath = /^\/(?:file\/d\/|drive\/(?:u\/\d+\/)?folders\/)[A-Za-z0-9_-]{10,}(?:\/|$)/.test(url.pathname);
    const legacyPath = /^\/(?:open|uc)$/.test(url.pathname) && /^[A-Za-z0-9_-]{10,}$/.test(url.searchParams.get("id") || "");
    return url.protocol === "https:" && url.hostname === "drive.google.com" && !url.port && !url.username && !url.password && (filePath || legacyPath);
  } catch { return false; }
}, "Укажите ссылку на файл или папку Google Диска.") }).strict();

/** Only paid orders can acquire a delivery URL. An already issued URL is frozen. */
export async function attachPaidBeatDelivery(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, beatId: true, deliveryMp3Url: true } });
  if (!order || !["paid", "pending_free_checkout"].includes(order.status) || order.deliveryMp3Url) return;
  const delivery = await tx.beatDelivery.findUnique({ where: { beatId: order.beatId }, select: { url: true } });
  if (delivery?.url) await tx.order.updateMany({ where: { id: orderId, deliveryMp3Url: null, status: { in: ["paid", "pending_free_checkout"] } }, data: { deliveryMp3Url: delivery.url } });
}
