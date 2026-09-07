/**
 * Pure mappers between the Prisma row, the internal {@link BeatRecord}, and the
 * public / admin DTOs. No Prisma, no I/O — the public-URL resolver is injected so
 * these can be unit-tested.
 *
 * The PUBLIC DTO never carries `masterKey`, `archiveKey`, any object key or path,
 * a private URL, or upload state.
 */

import type { Beat as PrismaBeat } from "@prisma/client";
import type { AdminBeat, Beat, BeatGenre, BeatRecord, BeatStatus } from "@/types/beat";

export type PublicUrlResolver = (key: string | null) => string | null;

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const total = Math.round(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Prisma row → internal record (Dates become ISO strings). */
export function toBeatRecord(row: PrismaBeat): BeatRecord {
  return {
    id: row.id,
    slug: row.slug,
    caseNumber: row.caseNumber,
    title: row.title,
    status: row.status as BeatStatus,
    genre: row.genre as BeatGenre,
    substyle: row.substyle,
    mood: row.mood,
    bpm: row.bpm,
    description: row.description,
    durationSeconds: row.durationSeconds,
    coverPalette: row.coverPalette,
    priceUsd: row.priceUsd,
    priceRub: row.priceRub,
    featured: row.featured,
    availableForDownload: row.availableForDownload,
    coverKey: row.coverKey,
    previewKey: row.previewKey,
    masterKey: row.masterKey,
    archiveKey: row.archiveKey,
    previewFileName: row.previewFileName,
    previewMimeType: row.previewMimeType,
    previewSizeBytes: row.previewSizeBytes,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Internal record → PUBLIC DTO. Only `coverKey` / `previewKey` are resolved. */
export function toPublicBeat(record: BeatRecord, resolvePublicUrl: PublicUrlResolver): Beat {
  return {
    id: record.id,
    slug: record.slug,
    caseNumber: record.caseNumber,
    title: record.title,
    status: record.status,
    genre: record.genre,
    substyle: record.substyle,
    mood: record.mood,
    bpm: record.bpm,
    description: record.description,
    duration: formatDuration(record.durationSeconds),
    coverPalette: record.coverPalette,
    coverImageUrl: resolvePublicUrl(record.coverKey),
    previewUrl: resolvePublicUrl(record.previewKey),
    priceUsd: record.priceUsd,
    priceRub: record.priceRub,
    featured: record.featured,
    availableForDownload: record.availableForDownload,
    createdAt: record.createdAt,
  };
}

/** Internal record → ADMIN DTO. Public fields + storage references + preview meta. */
export function toAdminBeat(record: BeatRecord, resolvePublicUrl: PublicUrlResolver): AdminBeat {
  return {
    ...toPublicBeat(record, resolvePublicUrl),
    coverKey: record.coverKey,
    previewKey: record.previewKey,
    masterKey: record.masterKey,
    archiveKey: record.archiveKey,
    hasCover: record.coverKey !== null,
    hasPreview: record.previewKey !== null,
    hasMaster: record.masterKey !== null,
    hasArchive: record.archiveKey !== null,
    previewFileName: record.previewFileName,
    previewMimeType: record.previewMimeType,
    previewSizeBytes: record.previewSizeBytes,
    durationSeconds: record.durationSeconds,
    publishedAt: record.publishedAt,
    updatedAt: record.updatedAt,
  };
}
