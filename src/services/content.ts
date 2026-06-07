import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getDefaultSubstyle, inferGenreFromMoodText } from "@/lib/beats-taxonomy";
import { mockArtistPosts, mockArtists, mockBeats, mockComments, mockPosts, mockReleases, mockTracks, siteSettings } from "@/services/mock-data";
import type { Artist, ArtistPost, Beat, Comment, Post, Release, ReleaseTrack, SiteSettings, Track, TrackDownloadLog } from "@/types";

type BeatRow = {
  id: string;
  title: string;
  slug: string;
  case_number: string;
  cover_palette: string;
  cover_image_url: string | null;
  cover_image_path: string | null;
  preview_url: string | null;
  preview_storage_path: string | null;
  preview_file_name: string | null;
  preview_mime_type: string | null;
  preview_size_bytes: number | null;
  wav_file_path: string | null;
  zip_file_path: string | null;
  genre: Beat["genre"] | null;
  substyle: string | null;
  bpm: number;
  mood: string;
  description: string;
  price_usd: number;
  price_rub: number | null;
  status: Beat["status"];
  featured: boolean;
  created_at: string;
  duration: string;
  available_for_download: boolean;
};

type LegacyBeatRow = {
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
  status: Beat["status"];
  featured: boolean;
  created_at: string;
  duration: string;
};

type TrackRow = {
  id: string;
  title: string;
  slug: string;
  artist_name: string;
  cover_palette: string;
  cover_image_url: string | null;
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
};

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

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  section: Post["section"];
  cover_palette: string;
  cta_label: string | null;
  cta_url: string | null;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type SiteSettingsRow = {
  title: string;
  subtitle: string;
  archive_headline: string;
  archive_description: string;
};

function mapBeat(row: BeatRow): Beat {
  const genre = row.genre ?? inferGenreFromMoodText(row.mood);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    caseNumber: row.case_number,
    coverPalette: row.cover_palette,
    coverImageUrl: row.cover_image_url,
    coverImagePath: row.cover_image_path,
    previewUrl: row.preview_url,
    previewStoragePath: row.preview_storage_path,
    previewFileName: row.preview_file_name,
    previewMimeType: row.preview_mime_type,
    previewSizeBytes: row.preview_size_bytes,
    wavFilePath: row.wav_file_path,
    zipFilePath: row.zip_file_path,
    genre,
    substyle: row.substyle ?? getDefaultSubstyle(genre),
    bpm: row.bpm,
    mood: row.mood,
    description: row.description,
    priceUsd: row.price_usd,
    priceRub: row.price_rub ?? 2500,
    status: row.status,
    featured: row.featured,
    createdAt: row.created_at,
    duration: row.duration,
    availableForDownload: row.available_for_download,
  };
}

function mapLegacyBeat(row: LegacyBeatRow): Beat {
  const genre = inferGenreFromMoodText(row.mood);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    caseNumber: row.case_number,
    coverPalette: row.cover_palette,
    coverImageUrl: null,
    coverImagePath: null,
    previewUrl: row.preview_url,
    previewStoragePath: null,
    previewFileName: null,
    previewMimeType: null,
    previewSizeBytes: null,
    wavFilePath: null,
    zipFilePath: null,
    genre,
    substyle: getDefaultSubstyle(genre),
    bpm: row.bpm,
    mood: row.mood,
    description: row.description,
    priceUsd: row.price_usd,
    priceRub: 2500,
    status: row.status,
    featured: row.featured,
    createdAt: row.created_at,
    duration: row.duration,
    availableForDownload: false,
  };
}

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    artistName: row.artist_name,
    coverPalette: row.cover_palette,
    coverImageUrl: row.cover_image_url,
    coverImagePath: row.cover_image_path,
    mp3FilePath: row.mp3_file_path,
    spotifyUrl: row.spotify_url,
    appleMusicUrl: row.apple_music_url,
    youtubeUrl: row.youtube_url,
    releaseDate: row.release_date,
    releaseId: row.release_id,
    trackNumber: row.track_number,
    isDemo: row.is_demo ?? false,
    createdAt: row.created_at,
  };
}

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

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    section: row.section,
    coverPalette: row.cover_palette,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    published: row.published,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSiteSettings(row: SiteSettingsRow): SiteSettings {
  return {
    title: row.title,
    subtitle: row.subtitle,
    archiveHeadline: row.archive_headline,
    archiveDescription: row.archive_description,
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
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("title, subtitle, archive_headline, archive_description")
      .eq("key", "primary")
      .maybeSingle<SiteSettingsRow>();

    if (error || !data) {
      return siteSettings;
    }

    return mapSiteSettings(data);
  }, siteSettings);
}

export async function getFeaturedBeats() {
  const beats = await getBeats();
  return beats.filter((beat) => beat.featured);
}

export async function getBeatBySlug(slug: string) {
  console.info("[content] getBeatBySlug", { slug });
  const beats = await getBeats();
  const directMatch = beats.find((entry) => entry.slug === slug) ?? null;
  const normalizedSlug = normalizeSlugCandidate(slug);
  const normalizedMatch = beats.find((entry) => normalizeSlugCandidate(entry.slug) === normalizedSlug) ?? null;
  const beat = directMatch ?? normalizedMatch;

  console.info("[content] getBeatBySlug result", {
    slug,
    found: Boolean(beat),
    beatId: beat?.id ?? null,
    beatSlug: beat?.slug ?? null,
    status: beat?.status ?? null,
  });

  return beat;
}

export async function getBeats() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();

    console.info("[content] querying beats", {
      table: "beats",
      filters: { statusIn: ["available", "reserved"] },
      order: "created_at desc",
    });

    const richQuery = supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, cover_image_url, cover_image_path, preview_url, preview_storage_path, preview_file_name, preview_mime_type, preview_size_bytes, wav_file_path, zip_file_path, genre, substyle, bpm, mood, description, price_usd, price_rub, status, featured, created_at, duration, available_for_download",
      )
      .in("status", ["available", "reserved"])
      .order("created_at", { ascending: false });

    const { data, error } = await richQuery.returns<BeatRow[]>();

    if (!error && data) {
      console.info("[content] beats query result", {
        source: "rich",
        count: data.length,
      });
      return data.map(mapBeat);
    }

    console.warn("[content] rich beats query failed, trying legacy shape", {
      error: error?.message ?? null,
    });

    const legacyQuery = supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, preview_url, bpm, mood, description, price_usd, status, featured, created_at, duration",
      )
      .in("status", ["available", "reserved"])
      .order("created_at", { ascending: false });

    const legacy = await legacyQuery.returns<LegacyBeatRow[]>();

    if (!legacy.error && legacy.data) {
      console.info("[content] beats query result", {
        source: "legacy",
        count: legacy.data.length,
      });
      return legacy.data.map(mapLegacyBeat);
    }

    console.warn("[content] legacy beats query failed", {
      error: legacy.error?.message ?? null,
    });

    return [] as Beat[];
  }, mockBeats.filter((beat) => beat.status === "available" || beat.status === "reserved"));
}

export async function getTracks() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, slug, artist_name, cover_palette, cover_image_url, cover_image_path, mp3_file_path, spotify_url, apple_music_url, youtube_url, release_date, release_id, track_number, is_demo, created_at",
      )
      .order("release_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<TrackRow[]>();

    if (error || !data) {
      return mockTracks;
    }

    return data.map(mapTrack);
  }, mockTracks);
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
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("releases")
      .select(
        "id, title, slug, artist_name, feat_artist_names, release_type, cover_palette, cover_image_url, cover_image_path, description, spotify_url, apple_music_url, youtube_url, release_date, published, featured, created_at, updated_at, tracks:tracks(id, title, slug, track_number, mp3_file_path, created_at)",
      )
      .eq("published", true)
      .order("release_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<ReleaseRow[]>();

    if (error || !data) {
      return mockReleases;
    }

    return data.map(mapRelease);
  }, mockReleases);
}

export async function getAdminReleases() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("releases")
      .select(
        "id, title, slug, artist_name, feat_artist_names, release_type, cover_palette, cover_image_url, cover_image_path, description, spotify_url, apple_music_url, youtube_url, release_date, published, featured, created_at, updated_at, tracks:tracks(id, title, slug, track_number, mp3_file_path, created_at)",
      )
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<ReleaseRow[]>();

    if (error || !data) {
      return mockReleases;
    }

    return data.map(mapRelease);
  }, mockReleases);
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
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, title, slug, excerpt, content, category, section, cover_palette, cta_label, cta_url, published, featured, created_at, updated_at",
      )
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PostRow[]>();

    if (error || !data) {
      return filterPostsBySection(mockPosts, section);
    }

    return filterPostsBySection(data.map(mapPost), section);
  }, filterPostsBySection(mockPosts, section));
}

export async function getAdminBeats() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const richQuery = supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, cover_image_url, cover_image_path, preview_url, preview_storage_path, preview_file_name, preview_mime_type, preview_size_bytes, wav_file_path, zip_file_path, genre, substyle, bpm, mood, description, price_usd, price_rub, status, featured, created_at, duration, available_for_download",
      )
      .order("created_at", { ascending: false });

    const { data, error } = await richQuery.returns<BeatRow[]>();

    if (!error && data) {
      return data.map(mapBeat);
    }

    const legacyQuery = supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, preview_url, bpm, mood, description, price_usd, status, featured, created_at, duration",
      )
      .order("created_at", { ascending: false });

    const legacy = await legacyQuery.returns<LegacyBeatRow[]>();

    if (!legacy.error && legacy.data) {
      return legacy.data.map(mapLegacyBeat);
    }

    return [] as Beat[];
  }, mockBeats);
}

export async function getAdminTracks() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, slug, artist_name, cover_palette, cover_image_url, cover_image_path, mp3_file_path, spotify_url, apple_music_url, youtube_url, release_date, release_id, track_number, is_demo, created_at",
      )
      .order("is_demo", { ascending: true })
      .order("release_date", { ascending: false })
      .returns<TrackRow[]>();

    if (error || !data) {
      return mockTracks;
    }

    return data.map(mapTrack);
  }, mockTracks);
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
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, title, slug, excerpt, content, category, section, cover_palette, cta_label, cta_url, published, featured, created_at, updated_at",
      )
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PostRow[]>();

    if (error || !data) {
      return mockPosts;
    }

    return data.map(mapPost);
  }, mockPosts);
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
