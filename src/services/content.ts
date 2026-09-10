import { siteSettings } from "@/services/mock-data";
import type { Artist, ArtistPost, Beat, Comment, Post, Release, SiteSettings, Track, TrackDownloadLog } from "@/types";
import { BeatService } from "@/lib/beats/service";
import { prisma } from "@/lib/db/client";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";

const beatService = new BeatService();









type PostgresTrackRow = Awaited<ReturnType<typeof prisma.track.findFirst>>;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapPostgresTrack(row: NonNullable<PostgresTrackRow>): Track {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    artistName: row.artistName,
    coverPalette: row.coverPalette,
    coverImageUrl: resolvePublicObjectUrl(row.coverKey),
    coverImagePath: row.coverKey,
    mp3FilePath: row.audioKey,
    spotifyUrl: row.spotifyUrl,
    appleMusicUrl: row.appleMusicUrl,
    youtubeUrl: row.youtubeUrl,
    releaseDate: dateOnly(row.releaseDate),
    releaseId: row.releaseId,
    trackNumber: row.trackNumber,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}

type PostgresReleaseRow = Awaited<ReturnType<typeof prisma.release.findFirst>> & {
  tracks: Array<NonNullable<PostgresTrackRow>>;
};

function mapPostgresRelease(row: PostgresReleaseRow): Release {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    artistName: row.artistName,
    releaseType: row.releaseType,
    coverPalette: row.coverPalette,
    coverImageUrl: resolvePublicObjectUrl(row.coverKey),
    coverImagePath: row.coverKey,
    description: row.description,
    spotifyUrl: row.spotifyUrl,
    appleMusicUrl: row.appleMusicUrl,
    youtubeUrl: row.youtubeUrl,
    featArtistNames: row.featArtistNames,
    releaseDate: dateOnly(row.releaseDate),
    published: row.published,
    featured: row.featured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tracks: row.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      slug: track.slug,
      trackNumber: track.trackNumber ?? 0,
      mp3FilePath: track.audioKey,
      createdAt: track.createdAt.toISOString(),
    })),
  };
}





const LEGACY_PUBLIC_STORAGE_URL = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/([a-z0-9-]+)\/([^\s)"']+)/gi;
const PUBLIC_LEGACY_BUCKETS = new Set(["media-images", "post-files", "beat-previews"]);

function rewriteLegacyPublicStorageUrls(value: string): string {
  return value.replace(LEGACY_PUBLIC_STORAGE_URL, (original, bucket: string, path: string) => {
    if (!PUBLIC_LEGACY_BUCKETS.has(bucket)) return original;
    return resolvePublicObjectUrl(`legacy-supabase/${bucket}/${path}`) ?? original;
  });
}

type PostgresPostRow = Awaited<ReturnType<typeof prisma.post.findFirst>>;

function mapPostgresPost(row: NonNullable<PostgresPostRow>): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: rewriteLegacyPublicStorageUrls(row.content),
    category: row.category,
    section: row.section as Post["section"],
    coverPalette: row.coverPalette,
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl ? rewriteLegacyPublicStorageUrls(row.ctaUrl) : null,
    published: row.published,
    featured: row.featured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}


function normalizeSlugCandidate(value: string): string {
  const trimmed = value.trim();

  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function filterPostsBySection(posts: Post[], section?: Post["section"]) {
  if (!section) {
    return posts.filter((post) => post.published);
  }

  return posts.filter((post) => post.published && (post.section === section || post.section === "general"));
}

export async function getSiteSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "primary" } });
  if (!row) return siteSettings;
  return {
    title: row.title,
    subtitle: row.subtitle,
    archiveHeadline: row.archiveHeadline,
    archiveDescription: row.archiveDescription,
  } satisfies SiteSettings;
}

// ── Beats: PostgreSQL only (BeatService). No Supabase, no mock fallback. ──────

export async function getBeats(): Promise<Beat[]> {
  return beatService.listPublic({ limit: 100 });
}

export async function getFeaturedBeats(): Promise<Beat[]> {
  const beats = await beatService.listPublic({ limit: 100 });
  return beats.filter((beat) => beat.featured);
}

export async function getBeatBySlug(slug: string): Promise<Beat | null> {
  const direct = await beatService.getPublicBySlug(slug);
  if (direct) {
    return direct;
  }

  const normalized = normalizeSlugCandidate(slug);
  if (normalized && normalized !== slug.trim().toLowerCase()) {
    return beatService.getPublicBySlug(normalized);
  }

  return null;
}

export async function getTracks() {
  const rows = await prisma.track.findMany({ orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }] });
  return rows.map(mapPostgresTrack);
}

export async function getSingleTracks() {
  const tracks = await getTracks();
  return tracks.filter((t) => !t.releaseId && !t.isDemo);
}

export async function getDemoTracks() {
  const tracks = await getTracks();
  return tracks.filter((t) => t.isDemo);
}

export async function getReleases() {
  const rows = await prisma.release.findMany({
    where: { published: true },
    include: { tracks: { orderBy: [{ trackNumber: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapPostgresRelease);
}

export async function getAdminReleases() {
  const rows = await prisma.release.findMany({
    include: { tracks: { orderBy: [{ trackNumber: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapPostgresRelease);
}

function mapArtistRow(row: {
  id: string; slug: string; artistName: string; trackTitle: string; beatTitle: string; bio: string;
  photoKey: string | null; coverPalette: string; spotifyUrl: string; appleMusicUrl: string; youtubeUrl: string;
  vkUrl: string; telegramUrl: string; yandexMusicUrl: string; tidalUrl: string; soundcloudUrl: string; createdAt: Date;
}): Artist {
  return {
    id: row.id, slug: row.slug, artistName: row.artistName, trackTitle: row.trackTitle, beatTitle: row.beatTitle,
    bio: row.bio, photoUrl: resolvePublicObjectUrl(row.photoKey), photoPath: row.photoKey, coverPalette: row.coverPalette,
    spotifyUrl: row.spotifyUrl, appleMusicUrl: row.appleMusicUrl, youtubeUrl: row.youtubeUrl, vkUrl: row.vkUrl,
    telegramUrl: row.telegramUrl, yandexMusicUrl: row.yandexMusicUrl, tidalUrl: row.tidalUrl,
    soundcloudUrl: row.soundcloudUrl, createdAt: row.createdAt.toISOString(),
  };
}

export async function getArtists(): Promise<Artist[]> {
  const rows = await prisma.artist.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(mapArtistRow);
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const row = await prisma.artist.findUnique({ where: { slug } });
  return row ? mapArtistRow(row) : null;
}

export async function getArtistReleases(_artistId: string, artistName: string): Promise<Release[]> {
  const name = artistName.trim();
  if (!name) return [];
  const rows = await prisma.release.findMany({
    where: {
      published: true,
      OR: [
        { artistName: { contains: name, mode: "insensitive" } },
        { featArtistNames: { contains: name, mode: "insensitive" } },
      ],
    },
    include: { tracks: { orderBy: [{ trackNumber: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapPostgresRelease);
}

export async function getArtistPosts(artistId: string): Promise<ArtistPost[]> {
  const rows = await prisma.artistPost.findMany({
    where: { artistId, published: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id, artistId: row.artistId, authorId: row.authorId, title: row.title, body: row.body,
    imageUrl: resolvePublicObjectUrl(row.imageKey), imagePath: row.imageKey,
    audioUrl: resolvePublicObjectUrl(row.audioKey), audioPath: row.audioKey,
    published: row.published, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getComments(entity: Comment["entity"], contentId: string): Promise<Comment[]> {
  const rows = await prisma.comment.findMany({
    where: { entity, contentId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id, entity: row.entity as Comment["entity"], contentId: row.contentId, authorId: row.authorId,
    displayName: row.displayName, body: row.body, stars: row.stars, createdAt: row.createdAt.toISOString(),
  }));
}

export async function getPosts(section?: Post["section"]) {
  const rows = await prisma.post.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });
  return filterPostsBySection(rows.map(mapPostgresPost), section);
}

export async function getAdminBeats() {
  const { items } = await beatService.listAdmin({ limit: 100 });
  return items;
}

export async function getAdminTracks() {
  const rows = await prisma.track.findMany({ orderBy: [{ isDemo: "asc" }, { releaseDate: "desc" }] });
  return rows.map(mapPostgresTrack);
}

export async function getAdminArtists(): Promise<Artist[]> {
  return getArtists();
}

export async function getAdminPosts() {
  const rows = await prisma.post.findMany({ orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });
  return rows.map(mapPostgresPost);
}

export async function getAdminTrackDownloads(): Promise<TrackDownloadLog[]> {
  const rows = await prisma.trackDownloadLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return rows.map((row) => ({
    id: row.id, trackId: row.trackId, trackTitle: row.trackTitle, userId: row.userId,
    userEmail: row.userEmail, downloadedAt: row.createdAt.toISOString(),
  }));
}
