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

/** Caller holds the beat row lock before recording payment or spending points. */
export async function preparedBeatDelivery(tx: Prisma.TransactionClient, beatId: string) {
  const beat = await tx.beat.findUnique({ where: { id: beatId }, select: { archiveKey: true, delivery: { select: { url: true } } } });
  if (!beat?.delivery?.url && !beat?.archiveKey) throw new Error("BEAT_DELIVERY_MISSING");
  return { deliveryMp3Url: beat.delivery?.url ?? null, deliveryArchiveKey: beat.archiveKey };
}

/** Only paid orders acquire missing delivery details. Issued files are frozen. */
export async function attachPaidBeatDelivery(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, beatId: true, deliveryMp3Url: true, deliveryArchiveKey: true } });
  if (!order || !["paid", "pending_free_checkout"].includes(order.status) || order.deliveryMp3Url || order.deliveryArchiveKey) return;
  const beat = await tx.beat.findUnique({ where: { id: order.beatId }, select: { archiveKey: true, delivery: { select: { url: true } } } });
  if (beat?.delivery?.url || beat?.archiveKey) await tx.order.updateMany({ where: { id: orderId, deliveryMp3Url: null, deliveryArchiveKey: null, status: { in: ["paid", "pending_free_checkout"] } }, data: { deliveryMp3Url: beat.delivery?.url ?? null, deliveryArchiveKey: beat.archiveKey } });
}
