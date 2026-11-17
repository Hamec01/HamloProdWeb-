import { releaseExpiredReservations } from "@/lib/orders/reservations";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { toBeatRecord, toPublicBeat } from "@/lib/data/beat-mappers";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";
import type { BeatGenre } from "@/lib/beats-taxonomy";
import { BEATS_PER_PAGE, CAROUSEL_BEATS, beatPagination, type BeatReactionStats } from "./pagination";

const publicWhere = { publishedAt: { not: null }, status: { in: ["available", "reserved", "sold"] } } satisfies Prisma.BeatWhereInput;

export async function getBeatCatalog(rawPage?: string, genre?: BeatGenre) {
  await releaseExpiredReservations();
  const where = { ...publicWhere, ...(genre ? { genre } : {}) };
  const total = await prisma.beat.count({ where });
  const pagination = beatPagination(rawPage, total);
  const [rows, randomIds] = await Promise.all([
    prisma.beat.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: BEATS_PER_PAGE }),
    // A fresh sample of the complete public catalogue for each page request.
    prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM beats WHERE published_at IS NOT NULL AND status IN ('available', 'reserved', 'sold') ORDER BY random() LIMIT ${CAROUSEL_BEATS}`,
  ]);
  const randomRows = randomIds.length ? await prisma.beat.findMany({ where: { ...publicWhere, id: { in: randomIds.map((row) => row.id) } } }) : [];
  const map = new Map(randomRows.map((row) => [row.id, row]));
  return {
    ...pagination, total,
    beats: rows.map((row) => toPublicBeat(toBeatRecord(row), resolvePublicObjectUrl)),
    carousel: randomIds.flatMap(({ id }) => {
      const row = map.get(id);
      return row ? [toPublicBeat(toBeatRecord(row), resolvePublicObjectUrl)] : [];
    }),
  };
}

export async function getCatalogReactions(ids: string[], userId: string | null): Promise<Record<string, BeatReactionStats>> {
  if (!ids.length) return {};
  const [groups, mine] = await Promise.all([
    prisma.beatReaction.groupBy({ by: ["beatId", "reaction"], where: { beatId: { in: ids } }, _count: { _all: true } }),
    userId ? prisma.beatReaction.findMany({ where: { beatId: { in: ids }, userId }, select: { beatId: true, reaction: true } }) : [],
  ]);
  const result = Object.fromEntries(ids.map((id) => [id, { likes: 0, dislikes: 0, userReaction: null } as BeatReactionStats]));
  for (const group of groups) {
    if (group.reaction === "like") result[group.beatId].likes = group._count._all;
    if (group.reaction === "dislike") result[group.beatId].dislikes = group._count._all;
  }
  for (const reaction of mine) {
    if (reaction.reaction === "like" || reaction.reaction === "dislike") result[reaction.beatId].userReaction = reaction.reaction;
  }
  return result;
}
