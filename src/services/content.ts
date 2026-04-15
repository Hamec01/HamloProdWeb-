import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { mockArtists, mockBeats, mockTracks, siteSettings } from "@/services/mock-data";
import type { Artist, Beat, Order, SiteSettings, Track, TrackDownloadLog } from "@/types";

type BeatRow = {
  id: string;
  title: string;
  slug: string;
  case_number: string;
  cover_palette: string;
  cover_image_url: string | null;
  cover_image_path: string | null;
  preview_url: string;
  preview_storage_path: string | null;
  wav_file_path: string | null;
  zip_file_path: string | null;
  bpm: number;
  mood: string;
  description: string;
  price_usd: number;
  status: Beat["status"];
  featured: boolean;
  created_at: string;
  duration: string;
  available_for_download: boolean;
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
  created_at: string;
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
  artist_name: string;
  track_title: string;
  beat_title: string;
  cover_palette: string;
  spotify_url: string;
  apple_music_url: string;
  youtube_url: string;
  created_at: string;
};

type SiteSettingsRow = {
  title: string;
  subtitle: string;
  archive_headline: string;
  archive_description: string;
};

type OrderRow = {
  id: string;
  beat_id: string;
  buyer_user_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_country: string | null;
  buyer_city: string | null;
  buyer_phone: string | null;
  license_type: string;
  contract_language: string;
  base_price_usd: number;
  discount_percent: number;
  final_price_usd: number;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapBeat(row: BeatRow): Beat {
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
    wavFilePath: row.wav_file_path,
    zipFilePath: row.zip_file_path,
    bpm: row.bpm,
    mood: row.mood,
    description: row.description,
    priceUsd: row.price_usd,
    status: row.status,
    featured: row.featured,
    createdAt: row.created_at,
    duration: row.duration,
    availableForDownload: row.available_for_download,
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
    createdAt: row.created_at,
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
    artistName: row.artist_name,
    trackTitle: row.track_title,
    beatTitle: row.beat_title,
    coverPalette: row.cover_palette,
    spotifyUrl: row.spotify_url,
    appleMusicUrl: row.apple_music_url,
    youtubeUrl: row.youtube_url,
    createdAt: row.created_at,
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

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    beatId: row.beat_id,
    buyerUserId: row.buyer_user_id,
    buyerEmail: row.buyer_email,
    buyerName: row.buyer_name,
    buyerCountry: row.buyer_country,
    buyerCity: row.buyer_city,
    buyerPhone: row.buyer_phone,
    licenseType: row.license_type as Order["licenseType"],
    contractLanguage: row.contract_language as Order["contractLanguage"],
    basePriceUsd: row.base_price_usd,
    discountPercent: row.discount_percent,
    finalPriceUsd: row.final_price_usd,
    status: row.status as Order["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function withSupabaseFallback<T>(resolver: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasSupabaseEnv()) {
    return fallback;
  }

  try {
    return await resolver();
  } catch {
    return fallback;
  }
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
  const beats = await getBeats();
  return beats.find((beat) => beat.slug === slug) ?? null;
}

export async function getBeats() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, cover_image_url, cover_image_path, preview_url, preview_storage_path, wav_file_path, zip_file_path, bpm, mood, description, price_usd, status, featured, created_at, duration, available_for_download",
      )
      .neq("status", "private")
      .order("created_at", { ascending: false })
      .returns<BeatRow[]>();

    if (error || !data) {
      return mockBeats;
    }

    return data.map(mapBeat);
  }, mockBeats);
}

export async function getTracks() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, slug, artist_name, cover_palette, cover_image_url, cover_image_path, mp3_file_path, spotify_url, apple_music_url, youtube_url, release_date, created_at",
      )
      .order("release_date", { ascending: false })
      .returns<TrackRow[]>();

    if (error || !data) {
      return mockTracks;
    }

    return data.map(mapTrack);
  }, mockTracks);
}

export async function getArtists() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("artists")
      .select(
        "id, artist_name, track_title, beat_title, cover_palette, spotify_url, apple_music_url, youtube_url, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<ArtistRow[]>();

    if (error || !data) {
      return mockArtists;
    }

    return data.map(mapArtist);
  }, mockArtists);
}

export async function getAdminBeats() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beats")
      .select(
        "id, title, slug, case_number, cover_palette, cover_image_url, cover_image_path, preview_url, preview_storage_path, wav_file_path, zip_file_path, bpm, mood, description, price_usd, status, featured, created_at, duration, available_for_download",
      )
      .order("created_at", { ascending: false })
      .returns<BeatRow[]>();

    if (error || !data) {
      return mockBeats;
    }

    return data.map(mapBeat);
  }, mockBeats);
}

export async function getAdminTracks() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, slug, artist_name, cover_palette, cover_image_url, cover_image_path, mp3_file_path, spotify_url, apple_music_url, youtube_url, release_date, created_at",
      )
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
      .select(
        "id, artist_name, track_title, beat_title, cover_palette, spotify_url, apple_music_url, youtube_url, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<ArtistRow[]>();

    if (error || !data) {
      return mockArtists;
    }

    return data.map(mapArtist);
  }, mockArtists);
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

export async function getAdminOrders() {
  return withSupabaseFallback(async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, beat_id, buyer_user_id, buyer_email, buyer_name, buyer_country, buyer_city, buyer_phone, license_type, contract_language, base_price_usd, discount_percent, final_price_usd, status, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<OrderRow[]>();

    if (error || !data) {
      return [];
    }

    return data.map(mapOrder);
  }, [] as Order[]);
}