import Link from "next/link";
import { ContentFeedbackCard } from "@/components/feedback/content-feedback-card";
import { TrackDownloadButton } from "@/components/tracks/track-download-button";
import { PlayTrackButton, type TrackQueueItem } from "@/components/tracks/play-track-button";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Release } from "@/types";

const releaseTypeLabels: Record<Release["releaseType"], Record<"ru" | "en", string>> = {
  album: { ru: "Альбом", en: "Album" },
  ep: { ru: "EP", en: "EP" },
  mixtape: { ru: "Mixtape", en: "Mixtape" },
};

export function ReleaseCard({
  release,
  isAuthenticated,
  locale,
}: {
  release: Release;
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const t = dictionary[locale];
  const typeLabel = releaseTypeLabels[release.releaseType][locale];

  const queue: TrackQueueItem[] = release.tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    slug: tr.slug,
    artistName: release.artistName,
    hasMp3: Boolean(tr.mp3FilePath),
  }));

  return (
    <article className="case-panel overflow-hidden p-4">
      {/* Cover */}
      {release.coverImageUrl ? (
        <div
          className="case-artwork h-52"
          style={{ backgroundImage: `url(${release.coverImageUrl})` }}
        />
      ) : (
        <div className={`h-52 border border-[var(--color-line)] bg-gradient-to-br ${release.coverPalette}`} />
      )}

      {/* Meta */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center gap-3">
          <span className="border border-[var(--color-line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-paper-400)]">
            {typeLabel}
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
            {t.release} / {release.releaseDate}
          </span>
        </div>
        <h3 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
          {release.title}
        </h3>
        <p className="text-sm text-[var(--color-paper-200)]">{release.artistName}</p>
        {release.description ? (
          <p className="pt-1 text-sm leading-6 text-[var(--color-paper-400)]">{release.description}</p>
        ) : null}
      </div>

      {/* Track list with play + download per track */}
      {release.tracks.length > 0 && (
        <ol className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-4">
          {release.tracks.map((track) => (
            <li key={track.id} className="flex items-center gap-2">
              <span className="shrink-0 w-5 text-right text-xs text-[var(--color-paper-400)]">
                {track.trackNumber}.
              </span>
              <span className="flex-1 truncate text-sm text-[var(--color-paper-200)]">{track.title}</span>
              <PlayTrackButton
                trackId={track.id}
                trackQueue={queue}
                locale={locale}
                size="small"
              />
              <TrackDownloadButton
                trackId={track.id}
                isAuthenticated={isAuthenticated}
                isAvailable={Boolean(track.mp3FilePath)}
                locale={locale}
                size="small"
              />
            </li>
          ))}
        </ol>
      )}

      {/* Streaming links */}
      <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
        {release.spotifyUrl ? (
          <Link
            href={release.spotifyUrl}
            target="_blank"
            className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]"
          >
            Spotify
          </Link>
        ) : null}
        {release.appleMusicUrl ? (
          <Link
            href={release.appleMusicUrl}
            target="_blank"
            className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]"
          >
            Apple Music
          </Link>
        ) : null}
        {release.youtubeUrl ? (
          <Link
            href={release.youtubeUrl}
            target="_blank"
            className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]"
          >
            YouTube
          </Link>
        ) : null}
      </div>

      <ContentFeedbackCard entity="tracks" contentId={release.id} isAuthenticated={isAuthenticated} locale={locale} />
    </article>
  );
}
