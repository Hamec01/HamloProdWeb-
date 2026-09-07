export type BeatStatus = "available" | "reserved" | "sold" | "private";
export type BeatGenre = "boombap" | "rap" | "trap" | "drill" | "another";

/**
 * Internal persistence shape — mirrors the Prisma `Beat` model. Carries object
 * keys (including the private master/archive keys). NEVER serialise this to a
 * public client; map to {@link Beat} or {@link AdminBeat} first.
 */
export type BeatRecord = {
  id: string;
  slug: string;
  caseNumber: string;
  title: string;
  status: BeatStatus;
  genre: BeatGenre;
  substyle: string | null;
  mood: string | null;
  bpm: number | null;
  description: string | null;
  durationSeconds: number | null;
  coverPalette: string;
  priceUsd: number;
  priceRub: number;
  featured: boolean;
  availableForDownload: boolean;
  coverKey: string | null;
  previewKey: string | null;
  masterKey: string | null;
  archiveKey: string | null;
  previewFileName: string | null;
  previewMimeType: string | null;
  previewSizeBytes: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Public catalogue DTO. No object keys, no paths, no `UploadIntent`, no private
 * URLs. `coverImageUrl` / `previewUrl` are resolved by the server from the public
 * object keys (or `null` when no file is attached).
 */
export type Beat = {
  id: string;
  slug: string;
  caseNumber: string;
  title: string;
  status: BeatStatus;
  genre: BeatGenre;
  substyle: string | null;
  mood: string | null;
  bpm: number | null;
  description: string | null;
  duration: string | null;
  coverPalette: string;
  coverImageUrl: string | null;
  previewUrl: string | null;
  priceUsd: number;
  priceRub: number;
  featured: boolean;
  availableForDownload: boolean;
  createdAt: string;
};

/**
 * Admin DTO. Public fields + allowed storage references. The admin UI is trusted
 * and may see the object keys; it still never receives a `UploadIntent`.
 */
export type AdminBeat = Beat & {
  coverKey: string | null;
  previewKey: string | null;
  masterKey: string | null;
  archiveKey: string | null;
  hasCover: boolean;
  hasPreview: boolean;
  hasMaster: boolean;
  hasArchive: boolean;
  previewFileName: string | null;
  previewMimeType: string | null;
  previewSizeBytes: number | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  updatedAt: string;
};
