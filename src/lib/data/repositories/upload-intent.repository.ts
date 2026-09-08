import type { UploadIntentState } from "@prisma/client";
import type { UploadKind } from "@/lib/storage/keys";
import type { StorageVisibility } from "@/lib/storage/object-storage";
import type { BeatRecord } from "@/types/beat";

export type BeatAssetKind = Extract<UploadKind, `beat-${string}`>;
export const BEAT_ASSET_FIELDS = {
  "beat-cover": "coverKey", "beat-preview": "previewKey",
  "beat-master": "masterKey", "beat-archive": "archiveKey",
} as const;
export function isBeatAssetKind(kind: unknown): kind is BeatAssetKind {
  return typeof kind === "string" && Object.hasOwn(BEAT_ASSET_FIELDS, kind);
}
export type PendingUpload = {
  ownerId: string; entityType: "beat"; entityId: string; kind: BeatAssetKind;
  visibility: StorageVisibility; key: string; contentType: string;
  expectedSize: number; expiresAt: Date;
};
export type UploadIntentRecord = PendingUpload & {
  state: UploadIntentState; actualSize: number | null; finalizedAt: Date | null;
};
export interface UploadIntentRepository {
  createPending(input: PendingUpload): Promise<void>;
  findByKey(key: string): Promise<UploadIntentRecord | null>;
  markFinalized(key: string, actualSize: number): Promise<boolean>;
  /** Used inside the transaction that updates the entity. */
  markAttached(key: string): Promise<boolean>;
  expireStale(limit: number): Promise<UploadIntentRecord[]>;
  markExpired(key: string): Promise<void>;
  attachBeatAsset(beatId: string, kind: BeatAssetKind, key: string, ownerId: string): Promise<BeatRecord | null>;
}
