"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const t = dictionary[locale];
  const typeLabel = releaseTypeLabels[release.releaseType][locale];

  const queue: TrackQueueItem[] = release.tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    slug: tr.slug,
    artistName: release.artistName,
    hasMp3: Boolean(tr.mp3FilePath),
  }));

  const firstTrack = release.tracks[0];

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* ── Compact card ── */}
      <article
        onClick={() => setIsOpen(true)}
        className="case-panel group cursor-pointer overflow-hidden transition-colors hover:border-[var(--color-paper-400)]"
      >
        {/* Cover */}
        {release.coverImageUrl ? (
          <div
            className="h-56 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${release.coverImageUrl})` }}
          />
        ) : (
          <div className={`h-56 w-full bg-gradient-to-br ${release.coverPalette}`} />
        )}

        {/* Info */}
        <div className="p-4 space-y-1">
          <div className="flex items-center gap-2">
            <span className="border border-[var(--color-line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-paper-400)]">
              {typeLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
              {release.releaseDate}
            </span>
          </div>
          <h3 className="font-sans text-xl uppercase tracking-[0.05em] text-[var(--color-paper-100)] truncate">
            {release.title}
          </h3>
          <p className="text-xs text-[var(--color-paper-300)]">{release.artistName}</p>
        </div>

        {/* Play button — stopPropagation so click doesn't open modal */}
        {firstTrack && (
          <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            <PlayTrackButton trackId={firstTrack.id} trackQueue={queue} locale={locale} />
          </div>
        )}
      </article>

      {/* ── Modal overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <article
            className="case-panel relative my-8 w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-400)] transition-colors hover:border-[var(--color-paper-200)] hover:text-[var(--color-paper-100)]"
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>

            {/* Cover */}
            {release.coverImageUrl ? (
              <div
                className="h-72 w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${release.coverImageUrl})` }}
              />
            ) : (
              <div className={`h-72 w-full bg-gradient-to-br ${release.coverPalette}`} />
            )}

            <div className="p-6 space-y-5">
              {/* Meta */}
              <div className="space-y-1">
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

              {/* Track list */}
              {release.tracks.length > 0 && (
                <ol className="space-y-2 border-t border-[var(--color-line)] pt-4">
                  {release.tracks.map((track) => (
                    <li key={track.id} className="flex items-center gap-2">
                      <span className="shrink-0 w-5 text-right text-xs text-[var(--color-paper-400)]">
                        {track.trackNumber}.
                      </span>
                      <span className="flex-1 truncate text-sm text-[var(--color-paper-200)]">{track.title}</span>
                      <PlayTrackButton trackId={track.id} trackQueue={queue} locale={locale} size="small" />
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
              {(release.spotifyUrl || release.appleMusicUrl || release.youtubeUrl) && (
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-4 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
                  {release.spotifyUrl && (
                    <Link href={release.spotifyUrl} target="_blank" onClick={(e) => e.stopPropagation()} className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
                      Spotify
                    </Link>
                  )}
                  {release.appleMusicUrl && (
                    <Link href={release.appleMusicUrl} target="_blank" onClick={(e) => e.stopPropagation()} className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
                      Apple Music
                    </Link>
                  )}
                  {release.youtubeUrl && (
                    <Link href={release.youtubeUrl} target="_blank" onClick={(e) => e.stopPropagation()} className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
                      YouTube
                    </Link>
                  )}
                </div>
              )}

              <ContentFeedbackCard entity="tracks" contentId={release.id} isAuthenticated={isAuthenticated} locale={locale} />
            </div>
          </article>
        </div>
      )}
    </>
  );
}
