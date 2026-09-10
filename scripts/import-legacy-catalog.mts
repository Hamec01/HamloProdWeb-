/** Import legacy Supabase releases/tracks into Prisma, preserving UUIDs. */

import { readFile } from "node:fs/promises";
import { PrismaClient, type Prisma, type ReleaseType } from "@prisma/client";

type LegacyRelease = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  feat_artist_names: string;
  release_type: string;
  cover_palette: string;
  cover_image_path: string | null;
  description: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  release_date: string;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type LegacyTrack = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  cover_palette: string;
  cover_image_path: string | null;
  mp3_file_path: string | null;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  release_date: string;
  release_id: string | null;
  track_number: number | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type StorageManifest = { source: string; key: string };

const VALID_RELEASE_TYPES = new Set<ReleaseType>(["album", "ep", "mixtape"]);

function lines<T>(input: string): T[] {
  return input.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
}

function date(value: string, field: string, id: string): Date {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${field} for ${id}`);
  return parsed;
}

function objectKey(bucket: string, oldPath: string | null, objects: Map<string, StorageManifest>): string | null {
  if (!oldPath) return null;
  const source = `${bucket}/${oldPath}`;
  const object = objects.get(source);
  if (!object) throw new Error(`Storage object missing from manifest: ${source}`);
  return object.key;
}

function assertUnique(label: string, values: Array<string | undefined>): void {
  if (values.some((value) => !value) || new Set(values).size !== values.length) {
    throw new Error(`Missing or duplicate ${label} in import`);
  }
}

const [releasesArg, tracksArg, manifestArg, mode] = process.argv.slice(2);
if (!releasesArg || !tracksArg || !manifestArg || !["--dry-run", "--apply"].includes(mode)) {
  throw new Error("Usage: import-legacy-catalog.mts <releases.jsonl> <tracks.jsonl> <storage-manifest.jsonl> (--dry-run|--apply)");
}

const releases = lines<LegacyRelease>(await readFile(releasesArg, "utf8"));
const tracks = lines<LegacyTrack>(await readFile(tracksArg, "utf8"));
const storage = lines<StorageManifest>(await readFile(manifestArg, "utf8"));
const objects = new Map(storage.map((entry) => [entry.source, entry]));

const mappedReleases: Prisma.ReleaseCreateManyInput[] = releases.map((release) => {
  if (!release.id || !release.slug.trim() || !release.title.trim()) throw new Error("Required release identity field missing");
  if (!VALID_RELEASE_TYPES.has(release.release_type as ReleaseType)) throw new Error(`Invalid release type for ${release.id}`);
  return {
    id: release.id,
    title: release.title,
    slug: release.slug,
    artistName: release.artist_name,
    featArtistNames: release.feat_artist_names || "",
    releaseType: release.release_type as ReleaseType,
    coverPalette: release.cover_palette,
    coverKey: objectKey("media-images", release.cover_image_path, objects),
    description: release.description || "",
    spotifyUrl: release.spotify_url || "",
    appleMusicUrl: release.apple_music_url || "",
    youtubeUrl: release.youtube_url || "",
    releaseDate: date(release.release_date, "release date", release.id),
    published: release.published,
    featured: release.featured,
    createdAt: date(release.created_at, "created date", release.id),
    updatedAt: date(release.updated_at, "updated date", release.id),
  };
});

const releaseIds = new Set(mappedReleases.map((release) => release.id));
const mappedTracks: Prisma.TrackCreateManyInput[] = tracks.map((track) => {
  if (!track.id || !track.slug.trim() || !track.title.trim()) throw new Error("Required track identity field missing");
  if (track.release_id && !releaseIds.has(track.release_id)) throw new Error(`Track ${track.id} references missing release ${track.release_id}`);
  if (track.track_number !== null && (!Number.isInteger(track.track_number) || track.track_number <= 0)) {
    throw new Error(`Invalid track number for ${track.id}`);
  }
  return {
    id: track.id,
    title: track.title,
    slug: track.slug,
    artistName: track.artist_name,
    coverPalette: track.cover_palette,
    coverKey: objectKey("media-images", track.cover_image_path, objects),
    audioKey: objectKey("track-downloads", track.mp3_file_path, objects),
    spotifyUrl: track.spotify_url || "",
    appleMusicUrl: track.apple_music_url || "",
    youtubeUrl: track.youtube_url || "",
    releaseDate: date(track.release_date, "release date", track.id),
    releaseId: track.release_id,
    trackNumber: track.track_number,
    isDemo: track.is_demo,
    createdAt: date(track.created_at, "created date", track.id),
    updatedAt: date(track.updated_at, "updated date", track.id),
  };
});

assertUnique("release id", mappedReleases.map((release) => release.id));
assertUnique("release slug", mappedReleases.map((release) => release.slug));
assertUnique("track id", mappedTracks.map((track) => track.id));
assertUnique("track slug", mappedTracks.map((track) => track.slug));

console.log(`releases=${mappedReleases.length}; release_covers=${mappedReleases.filter((release) => release.coverKey).length}`);
console.log(`tracks=${mappedTracks.length}; track_covers=${mappedTracks.filter((track) => track.coverKey).length}; audio=${mappedTracks.filter((track) => track.audioKey).length}`);
console.log(`release_tracks=${mappedTracks.filter((track) => track.releaseId).length}; singles=${mappedTracks.filter((track) => !track.releaseId && !track.isDemo).length}; demos=${mappedTracks.filter((track) => track.isDemo).length}`);
if (mode === "--dry-run") process.exit(0);

const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const [existingReleases, existingTracks] = await Promise.all([tx.release.count(), tx.track.count()]);
    if (existingReleases !== 0 || existingTracks !== 0) {
      throw new Error(`Target catalog tables are not empty (releases=${existingReleases}, tracks=${existingTracks})`);
    }
    const insertedReleases = await tx.release.createMany({ data: mappedReleases });
    const insertedTracks = await tx.track.createMany({ data: mappedTracks });
    if (insertedReleases.count !== mappedReleases.length || insertedTracks.count !== mappedTracks.length) {
      throw new Error(`Inserted releases ${insertedReleases.count}/${mappedReleases.length}; tracks ${insertedTracks.count}/${mappedTracks.length}`);
    }
  });
  console.log(`IMPORT COMPLETE: releases ${mappedReleases.length}/${mappedReleases.length}; tracks ${mappedTracks.length}/${mappedTracks.length}`);
} finally {
  await prisma.$disconnect();
}
