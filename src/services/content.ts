import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { mockArtistPosts, mockArtists, mockComments, mockReleases, siteSettings } from "@/services/mock-data";
import type { Artist, ArtistPost, Beat, Comment, Post, Release, ReleaseTrack, SiteSettings, Track, TrackDownloadLog } from "@/types";
import { BeatService } from "@/lib/beats/service";
import { prisma } from "@/lib/db/client";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";

const beatService = new BeatService();

type ReleaseTrackRow = {
  id: string;
  title: string;
  slug: string;
  track_number: number | null;
  mp3_file_path: string | null;
  created_at: string;
};

type ReleaseRow = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  release_type: Release["releaseType"];
  cover_palette: string;
  cover_image_url: string | null;
  cover_image_path: string | null;
  description: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  feat_artist_names: string;
  release_date: string;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  tracks: ReleaseTrackRow[];
};

type TrackDownloadRow = {
  id: string;
  track_id: string;
  track_title: string;
  user_id: string;
  user_email: string;
  downloaded_at: string;
};

type ArtistRow = {
  id: string;
  slug: string;
  artist_name: string;
  track_title: string;
  beat_title: string;
  bio: string;
  photo_url: string | null;
  photo_path: string | null;
  cover_palette: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  vk_url: string;
  telegram_url: string;
  yandex_music_url: string;
  tidal_url: string;
  soundcloud_url: string;
  created_at: string;
};

type ArtistPostRow = {
  id: string;
  artist_id: string;
  author_id: string | null;
  title: string;
  body: string;
  image_url: string | null;
  image_path: string | null;
  audio_url: string | null;
  audio_path: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  entity: Comment["entity"];
  content_id: string;
  author_id: string;
  display_name: string;
  body: string;
  stars: number | null;
  created_at: string;
};

function mapReleaseTrack(row: ReleaseTrackRow): ReleaseTrack {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    trackNumber: row.track_number ?? 0,
    mp3FilePath: row.mp3_file_path,
    createdAt: row.created_at,
  };
}

function mapRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    artistName: row.artist_name,
    releaseType: row.release_type,
    coverPalette: row.cover_palette,
    coverImageUrl: row.cover_image_url,
    coverImagePath: row.cover_image_path,
    description: row.description,
    spotifyUrl: row.spotify_url,
    appleMusicUrl: row.apple_music_url,
    youtubeUrl: row.youtube_url,
    featArtistNames: row.feat_artist_names ?? "",
    releaseDate: row.release_date,
    published: row.published,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tracks: (row.tracks ?? []).map(mapReleaseTrack).sort((a, b) => a.trackNumber - b.trackNumber),
  };
}

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

function mapTrackDownload(row: TrackDownloadRow): TrackDownloadLog {
  return {
    id: row.id,
    trackId: row.track_id,
    trackTitle: row.track_title,
    userId: row.user_id,
    userEmail: row.user_email,
    downloadedAt: row.downloaded_at,
  };
}

function mapArtist(row: ArtistRow): Artist {
  return {
    id: row.id,
    slug: row.slug,
    artistName: row.artist_name,
    trackTitle: row.track_title,
    beatTitle: row.beat_title,
    bio: row.bio,
    photoUrl: row.photo_url,
    photoPath: row.photo_path,
    coverPalette: row.cover_palette,
    spotifyUrl: row.spotify_url,
    appleMusicUrl: row.apple_music_url,
    youtubeUrl: row.youtube_url,
    vkUrl: row.vk_url,
    telegramUrl: row.telegram_url,
    yandexMusicUrl: row.yandex_music_url,
    tidalUrl: row.tidal_url,
    soundcloudUrl: row.soundcloud_url,
    createdAt: row.created_at,
  };
}

function mapArtistPost(row: ArtistPostRow): ArtistPost {
  return {
    id: row.id,
    artistId: row.artist_id,
    authorId: row.author_id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    audioUrl: row.audio_url,
    audioPath: row.audio_path,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    entity: row.entity,
    contentId: row.content_id,
    authorId: row.author_id,
    displayName: row.display_name,
    body: row.body,
    stars: row.stars,
    createdAt: row.created_at,
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

async function withSupabaseFallback<T>(resolver: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasSupabaseEnv()) {
    console.warn("[content] supabase env missing, using fallback data");
    return fallback;
  }

  try {
    return await resolver();
  } catch (error) {
    console.warn("[content] supabase resolver failed, using fallback data", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
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

const ARTIST_SELECT = "id, slug, artist_name, track_title, beat_title, bio, photo_url, photo_path, cover_palette, spotify_url, apple_music_url, youtube_url, vk_url, telegram_url, yandex_music_url, tidal_url, soundcloud_url, created_at";

export async function getArtists() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("artists")
      .select(ARTIST_SELECT)
      .order("created_at", { ascending: false })
      .returns<ArtistRow[]>();

    if (error || !data) {
      return mockArtists;
    }

    return data.map(mapArtist);
  }, mockArtists);
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("artists")
      .select(ARTIST_SELECT)
      .eq("slug", slug)
      .maybeSingle<ArtistRow>();

    if (error || !data) return null;
    return mapArtist(data);
  }, mockArtists.find((a) => a.slug === slug) ?? null);
}

export async function getArtistReleases(artistId: string, artistName: string): Promise<Release[]> {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("releases")
      .select(
        "id, title, slug, artist_name, feat_artist_names, release_type, cover_palette, cover_image_url, cover_image_path, description, spotify_url, apple_music_url, youtube_url, release_date, published, featured, created_at, updated_at, tracks:tracks(id, title, slug, track_number, mp3_file_path, created_at)",
      )
      .or(`artist_id.eq.${artistId},artist_name.ilike.%${artistName}%,feat_artist_names.ilike.%${artistName}%`)
      .eq("published", true)
      .order("release_date", { ascending: false })
      .returns<ReleaseRow[]>();

    if (error || !data) return [];
    return data.map(mapRelease);
  }, mockReleases.filter((r) => r.artistName === artistName));
}

export async function getArtistPosts(artistId: string): Promise<ArtistPost[]> {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("artist_posts")
      .select("id, artist_id, author_id, title, body, image_url, image_path, audio_url, audio_path, published, created_at, updated_at")
      .eq("artist_id", artistId)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .returns<ArtistPostRow[]>();

    if (error || !data) return [];
    return data.map(mapArtistPost);
  }, mockArtistPosts.filter((p) => p.artistId === artistId));
}

export async function getComments(entity: Comment["entity"], contentId: string): Promise<Comment[]> {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("comments")
      .select("id, entity, content_id, author_id, display_name, body, stars, created_at")
      .eq("entity", entity)
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .returns<CommentRow[]>();

    if (error || !data) return [];
    return data.map(mapComment);
  }, mockComments.filter((c) => c.entity === entity && c.contentId === contentId));
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

export async function getAdminArtists() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("artists")
      .select(ARTIST_SELECT)
      .order("created_at", { ascending: false })
      .returns<ArtistRow[]>();

    if (error || !data) {
      return mockArtists;
    }

    return data.map(mapArtist);
  }, mockArtists);
}

export async function getAdminPosts() {
  const rows = await prisma.post.findMany({ orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });
  return rows.map(mapPostgresPost);
}

export async function getAdminTrackDownloads() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("track_downloads")
      .select("id, track_id, track_title, user_id, user_email, downloaded_at")
      .order("downloaded_at", { ascending: false })
      .limit(30)
      .returns<TrackDownloadRow[]>();

    if (error || !data) {
      return [];
    }

    return data.map(mapTrackDownload);
  }, [] as TrackDownloadLog[]);
}
