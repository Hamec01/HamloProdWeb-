/** Import Supabase beat rows into the new Prisma schema, preserving UUIDs. */

import { readFile } from "node:fs/promises";
import { PrismaClient, type BeatGenre, type BeatStatus, type Prisma } from "@prisma/client";

type LegacyBeat = {
  id: string;
  title: string;
  slug: string;
  case_number: string;
  cover_palette: string;
  preview_url: string | null;
  bpm: number;
  mood: string;
  description: string;
  price_usd: number;
  status: string;
  featured: boolean;
  duration: string;
  created_at: string;
  updated_at: string;
  preview_storage_path: string | null;
  wav_file_path: string | null;
  zip_file_path: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  available_for_download: boolean | null;
  price_rub: number;
  genre: string;
  substyle: string;
  preview_file_name: string | null;
  preview_mime_type: string | null;
  preview_size_bytes: number | null;
};

type StorageManifest = { source: string; key: string; size: number };

const VALID_STATUSES = new Set<BeatStatus>(["available", "reserved", "sold", "private"]);
const VALID_GENRES = new Set<BeatGenre>(["boombap", "rap", "trap", "drill", "another"]);

function durationSeconds(value: string): number {
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid duration format: ${value}`);
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) throw new Error(`Invalid duration seconds: ${value}`);
  return minutes * 60 + seconds;
}

function objectKey(bucket: string, oldPath: string | null, objects: Map<string, StorageManifest>): string | null {
  if (!oldPath) return null;
  const source = `${bucket}/${oldPath}`;
  const object = objects.get(source);
  if (!object) throw new Error(`Storage object missing from manifest: ${source}`);
  return object.key;
}

const [beatsArg, manifestArg, mode] = process.argv.slice(2);
if (!beatsArg || !manifestArg || !["--dry-run", "--apply"].includes(mode)) {
  throw new Error("Usage: import-legacy-beats.mts <beats.jsonl> <storage-manifest.jsonl> (--dry-run|--apply)");
}

const beats = (await readFile(beatsArg, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as LegacyBeat);
const storage = (await readFile(manifestArg, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as StorageManifest);
const objects = new Map(storage.map((entry) => [entry.source, entry]));

const mapped: Prisma.BeatCreateManyInput[] = beats.map((beat) => {
  if (!VALID_STATUSES.has(beat.status as BeatStatus)) throw new Error(`Invalid status for ${beat.id}`);
  if (!VALID_GENRES.has(beat.genre as BeatGenre)) throw new Error(`Invalid genre for ${beat.id}`);
  if (!beat.id || !beat.slug || !beat.case_number || !beat.title) throw new Error("Required beat identity field missing");
  const createdAt = new Date(beat.created_at);
  const updatedAt = new Date(beat.updated_at);
  if (Number.isNaN(createdAt.valueOf()) || Number.isNaN(updatedAt.valueOf())) throw new Error(`Invalid date for ${beat.id}`);
  if (beat.preview_size_bytes !== null && (!Number.isSafeInteger(beat.preview_size_bytes) || beat.preview_size_bytes < 0)) {
    throw new Error(`Invalid preview size for ${beat.id}`);
  }
  return {
    id: beat.id,
    slug: beat.slug,
    caseNumber: beat.case_number,
    title: beat.title,
    status: beat.status as BeatStatus,
    genre: beat.genre as BeatGenre,
    substyle: beat.substyle || null,
    mood: beat.mood || null,
    bpm: beat.bpm,
    description: beat.description || null,
    durationSeconds: durationSeconds(beat.duration),
    coverPalette: beat.cover_palette,
    priceUsd: beat.price_usd,
    priceRub: beat.price_rub,
    featured: beat.featured,
    availableForDownload: beat.available_for_download ?? false,
    coverKey: objectKey("media-images", beat.cover_image_path, objects),
    previewKey: objectKey("beat-previews", beat.preview_storage_path, objects),
    masterKey: objectKey("beat-downloads", beat.wav_file_path, objects),
    archiveKey: objectKey("beat-downloads", beat.zip_file_path, objects),
    previewFileName: beat.preview_file_name,
    previewMimeType: beat.preview_mime_type,
    previewSizeBytes: beat.preview_size_bytes,
    publishedAt: createdAt,
    createdAt,
    updatedAt,
  };
});

const ids = new Set(mapped.map((beat) => beat.id));
const slugs = new Set(mapped.map((beat) => beat.slug));
const cases = new Set(mapped.map((beat) => beat.caseNumber));
if (ids.size !== mapped.length || slugs.size !== mapped.length || cases.size !== mapped.length) {
  throw new Error("Duplicate beat id, slug, or case number in import");
}

console.log(`validated=${mapped.length}`);
console.log(`covers=${mapped.filter((beat) => beat.coverKey).length}`);
console.log(`previews=${mapped.filter((beat) => beat.previewKey).length}`);
console.log(`available=${mapped.filter((beat) => beat.status === "available").length}; sold=${mapped.filter((beat) => beat.status === "sold").length}`);
if (mode === "--dry-run") process.exit(0);

const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.beat.count();
    if (existing !== 0) throw new Error(`Target beats table is not empty (${existing} rows)`);
    const inserted = await tx.beat.createMany({ data: mapped });
    if (inserted.count !== mapped.length) throw new Error(`Inserted ${inserted.count}/${mapped.length}`);
  });
  console.log(`IMPORT COMPLETE: ${mapped.length}/${mapped.length}`);
} finally {
  await prisma.$disconnect();
}
