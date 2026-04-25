import Link from "next/link";
import { ContentFeedbackCard } from "@/components/feedback/content-feedback-card";
import { TrackDownloadButton } from "@/components/tracks/track-download-button";
import { PlayTrackButton, type TrackQueueItem } from "@/components/tracks/play-track-button";
import { TrackCardInlineEditor } from "@/components/tracks/track-card-inline-editor";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Track } from "@/types";

export function TrackCard({
  track,
  trackQueue,
  isAuthenticated,
  locale,
}: {
  track: Track;
  trackQueue?: Track[];
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const t = dictionary[locale];
  const queue: TrackQueueItem[] = (trackQueue ?? [track]).map((tr) => ({
    id: tr.id,
    title: tr.title,
    slug: tr.slug,
    artistName: tr.artistName,
    hasMp3: Boolean(tr.mp3FilePath),
  }));

  return (
    <article className="case-panel relative overflow-hidden p-4">
      <TrackCardInlineEditor
        track={track}
        isAuthenticated={isAuthenticated}
      />
      {track.coverImageUrl ? (
        <div
          className="case-artwork h-44"
          style={{ backgroundImage: `url(${track.coverImageUrl})` }}
        />
      ) : (
        <div className={`h-44 border border-[var(--color-line)] bg-gradient-to-br ${track.coverPalette}`} />
      )}
      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">{t.release} / {track.releaseDate}</p>
        <h3 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{track.title}</h3>
        <p className="text-sm text-[var(--color-paper-200)]">{track.artistName}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <PlayTrackButton trackId={track.id} trackQueue={queue} locale={locale} />
        <TrackDownloadButton trackId={track.id} isAuthenticated={isAuthenticated} isAvailable={Boolean(track.mp3FilePath)} locale={locale} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
        {track.spotifyUrl ? (
          <Link href={track.spotifyUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            Spotify
          </Link>
        ) : null}
        {track.appleMusicUrl ? (
          <Link href={track.appleMusicUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            Apple Music
          </Link>
        ) : null}
        {track.youtubeUrl ? (
          <Link href={track.youtubeUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            YouTube
          </Link>
        ) : null}
      </div>

      <ContentFeedbackCard entity="tracks" contentId={track.id} isAuthenticated={isAuthenticated} locale={locale} />
    </article>
  );
}