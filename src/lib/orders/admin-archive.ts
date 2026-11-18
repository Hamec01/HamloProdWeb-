import { prisma } from "@/lib/db/client";

export async function setRequestArchived(orderId: string, archived: boolean) {
  const result = await prisma.order.updateMany({
    where: { id: orderId, provider: "contact", status: "draft", licenseType: "exclusive" },
    data: { adminArchivedAt: archived ? new Date() : null },
  });
  return result.count === 1;
}
