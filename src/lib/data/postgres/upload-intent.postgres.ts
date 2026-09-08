import { Prisma, type UploadIntent, type UploadKind } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { toBeatRecord } from "@/lib/data/beat-mappers";
import { BEAT_ASSET_FIELDS, type BeatAssetKind, type PendingUpload, type UploadIntentRecord, type UploadIntentRepository } from "@/lib/data/repositories/upload-intent.repository";
import { keyMatchesKind } from "@/lib/storage/keys";
import { visibilityForKind } from "@/lib/storage/upload-rules";

const kinds: Record<BeatAssetKind, UploadKind> = {
  "beat-cover": "beatCover", "beat-preview": "beatPreview", "beat-master": "beatMaster", "beat-archive": "beatArchive",
};
function record(row: UploadIntent): UploadIntentRecord {
  const kind = (Object.keys(kinds) as BeatAssetKind[]).find(k => kinds[k] === row.kind);
  if (!kind || row.entityType !== "beat") throw new Error("Unsupported upload intent.");
  return { ...row, entityType: "beat", kind, expectedSize: Number(row.expectedSize), actualSize: row.actualSize === null ? null : Number(row.actualSize) };
}
export class PrismaUploadIntentRepository implements UploadIntentRepository {
  constructor(private readonly db = prisma) {}
  async createPending(input: PendingUpload) {
    await this.db.uploadIntent.create({ data: { ...input, kind: kinds[input.kind], state: "PENDING" } });
  }
  async findByKey(key: string) {
    const row = await this.db.uploadIntent.findUnique({ where: { key } });
    return row ? record(row) : null;
  }
  async markFinalized(key: string, actualSize: number) {
    const now = new Date();
    const result = await this.db.uploadIntent.updateMany({
      where: { key, state: "PENDING", expiresAt: { gt: now } },
      data: { state: "FINALIZED", actualSize, finalizedAt: now, expiresAt: new Date(now.getTime() + 86400_000) },
    });
    return result.count === 1;
  }
  async markAttached(key: string) {
    const result = await this.db.uploadIntent.updateMany({
      where: { key, state: "FINALIZED", expiresAt: { gt: new Date() } },
      data: { state: "ATTACHED", attachedAt: new Date() },
    });
    return result.count === 1;
  }
  async attachBeatAsset(beatId: string, kind: BeatAssetKind, key: string, ownerId: string) {
    if (!keyMatchesKind(key, kind) || key.split("/")[1] !== beatId) return null;
    return this.db.$transaction(async tx => {
      // Serialize replacements of the same beat; the displaced key is read under this lock.
      await tx.$queryRaw`SELECT id FROM beats WHERE id = ${beatId}::uuid FOR UPDATE`;
      const beat = await tx.beat.findUnique({ where: { id: beatId } });
      if (!beat) return null;
      const intent = await tx.uploadIntent.findUnique({ where: { key } });
      if (!intent || intent.ownerId !== ownerId || intent.entityType !== "beat" || intent.entityId !== beatId || intent.kind !== kinds[kind] || intent.visibility !== visibilityForKind(kind)) return null;
      const attached = await tx.uploadIntent.updateMany({
        where: { key, state: "FINALIZED", expiresAt: { gt: new Date() }, actualSize: { not: null } },
        data: { state: "ATTACHED", attachedAt: new Date() },
      });
      if (!attached.count) return null;
      const field = BEAT_ASSET_FIELDS[kind];
      const oldKey = beat[field];
      const updated = await tx.beat.update({ where: { id: beatId }, data: {
        [field]: key,
        ...(kind === "beat-preview" ? { previewMimeType: intent.contentType, previewSizeBytes: Number(intent.actualSize), previewFileName: key.split("/").at(-1) } : {}),
      } });
      if (oldKey && oldKey !== key) {
        // Wait out signed PUTs and in-flight uploads before deleting a displaced object.
        // Legacy keys may not have an intent: retain a durable cleanup record for them too.
        await tx.uploadIntent.upsert({ where: { key: oldKey },
          update: { state: "DELETING", expiresAt: new Date(Date.now() + 3600_000) },
          create: { ownerId, entityType: "beat", entityId: beatId, kind: kinds[kind], visibility: visibilityForKind(kind), key: oldKey, contentType: intent.contentType, expectedSize: 0, state: "DELETING", expiresAt: new Date(Date.now() + 3600_000) },
        });
      }
      return toBeatRecord(updated);
    });
  }
  async expireStale(limit: number) {
    const take = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit))) : 20;
    return this.db.$transaction(async tx => {
      const stale = await tx.uploadIntent.findMany({ where: {
        entityType: "beat", kind: { in: Object.values(kinds) },
        OR: [ { state: "DELETING", expiresAt: { lt: new Date() } }, { state: { in: ["PENDING", "FINALIZED"] }, expiresAt: { lt: new Date(Date.now() - 3600_000) } } ],
      }, orderBy: { updatedAt: "asc" }, take });
      const claimed: UploadIntentRecord[] = [];
      for (const row of stale) {
        const changed = await tx.uploadIntent.updateMany({ where: { id: row.id, state: row.state, updatedAt: row.updatedAt }, data: { state: "DELETING", updatedAt: new Date() } });
        if (changed.count) claimed.push(record({ ...row, state: "DELETING" }));
      }
      return claimed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
  async markExpired(key: string) {
    await this.db.uploadIntent.updateMany({ where: { key, state: "DELETING" }, data: { state: "EXPIRED" } });
  }
}
