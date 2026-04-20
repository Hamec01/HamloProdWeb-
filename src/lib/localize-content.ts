import { maybeAutoTranslate } from "@/lib/auto-translate";
import type { Locale } from "@/lib/i18n";
import type { Artist, Beat, Post, Track } from "@/types";

export async function localizeBeats(beats: Beat[], locale: Locale): Promise<Beat[]> {
  if (locale !== "en") {
    return beats;
  }

  return Promise.all(
    beats.map(async (beat) => ({
      ...beat,
      title: await maybeAutoTranslate(beat.title, locale),
      mood: await maybeAutoTranslate(beat.mood, locale),
      description: await maybeAutoTranslate(beat.description, locale),
    })),
  );
}

export async function localizeTracks(tracks: Track[], locale: Locale): Promise<Track[]> {
  if (locale !== "en") {
    return tracks;
  }

  return Promise.all(
    tracks.map(async (track) => ({
      ...track,
      title: await maybeAutoTranslate(track.title, locale),
      artistName: await maybeAutoTranslate(track.artistName, locale),
    })),
  );
}

export async function localizeArtists(artists: Artist[], locale: Locale): Promise<Artist[]> {
  if (locale !== "en") {
    return artists;
  }

  return Promise.all(
    artists.map(async (artist) => ({
      ...artist,
      artistName: await maybeAutoTranslate(artist.artistName, locale),
      trackTitle: await maybeAutoTranslate(artist.trackTitle, locale),
      beatTitle: await maybeAutoTranslate(artist.beatTitle, locale),
    })),
  );
}

export async function localizePosts(posts: Post[], locale: Locale): Promise<Post[]> {
  if (locale !== "en") {
    return posts;
  }

  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      title: await maybeAutoTranslate(post.title, locale),
      excerpt: await maybeAutoTranslate(post.excerpt, locale),
      content: await maybeAutoTranslate(post.content, locale),
      category: await maybeAutoTranslate(post.category, locale),
      ctaLabel: post.ctaLabel ? await maybeAutoTranslate(post.ctaLabel, locale) : null,
    })),
  );
}
