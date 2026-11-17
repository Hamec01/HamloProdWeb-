import type { Prisma } from "@prisma/client";

export async function lockBeatForExclusiveSale(tx: Pick<Prisma.TransactionClient, "beat">, beatId: string) {
  const result = await tx.beat.updateMany({
    where: { id: beatId, status: { in: ["available", "reserved"] } },
    data: { status: "sold", availableForDownload: false },
  });
  return result.count === 1;
}
