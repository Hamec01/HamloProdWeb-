"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { ContentFeedbackCard } from "@/components/feedback/content-feedback-card";
import { TrackDownloadButton } from "@/components/tracks/track-download-button";
import { PlayTrackButton, type TrackQueueItem } from "@/components/tracks/play-track-button";
import { TrackFavoriteButton } from "@/components/tracks/track-favorite-button";
import { TrackShareButton } from "@/components/tracks/track-share-button";
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
  initialOpen = false,
  hideCompact = false,
  onModalClose,
}: {
  release: Release;
  isAuthenticated: boolean;
  locale: Locale;
  /** Open modal immediately (e.g. triggered from carousel click) */
  initialOpen?: boolean;
  /** Hide the compact card and only render the modal overlay */
  hideCompact?: boolean;
  /** Called when the user closes the modal */
  onModalClose?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const router = useRouter();
  const t = dictionary[locale];
  const typeLabel = releaseTypeLabels[release.releaseType][locale];

  const queue: TrackQueueItem[] = release.tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    slug: tr.slug,
    artistName: release.artistName,
    hasMp3: Boolean(tr.mp3FilePath),
  }));

  const availableTracks = release.tracks.filter((tr) => Boolean(tr.mp3FilePath));
  const firstTrack = release.tracks[0];

  const handleClose = () => {
    setIsOpen(false);
    onModalClose?.();
  };

  const handleDownloadAll = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=/`);
      return;
    }
    if (availableTracks.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (const track of availableTracks) {
        const res = await fetch(`/api/tracks/${track.id}/download`, { method: "POST" });
        const payload = (await res.json().catch(() => null)) as { url?: string } | null;
        if (!payload?.url) continue;
        // Trigger browser download
        const a = document.createElement("a");
        a.href = payload.url;
        a.download = `${track.title}.mp3`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Small delay to avoid browser blocking multiple simultaneous downloads
        await new Promise((r) => setTimeout(r, 800));
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <>
      {/* ── Compact card ── */}
      {!hideCompact && (
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
            <p className="text-xs text-[var(--color-paper-300)]">
              {release.artistName}
              {release.featArtistNames ? <span className="text-[var(--color-paper-400)]"> feat. {release.featArtistNames}</span> : null}
            </p>
          </div>

          {/* Action buttons — stopPropagation so click doesn't open modal */}
          {firstTrack && (
            <div className="px-4 pb-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex-1">
                <PlayTrackButton trackId={firstTrack.id} trackQueue={queue} locale={locale} />
              </div>
              {availableTracks.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  title={locale === "ru" ? "Скачать всё" : "Download all"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDownloadingAll ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              )}
            </div>
          )}
        </article>
      )}

      {/* ── Modal overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <article
            className="case-panel relative my-8 w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-400)] transition-colors hover:border-[var(--color-paper-200)] hover:text-[var(--color-paper-100)]"
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>

            {/* Cover — full image, no crop */}
            {release.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={release.coverImageUrl}
                alt={release.title}
                className="block w-full"
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
                <p className="text-sm text-[var(--color-paper-200)]">
                  {release.artistName}
                  {release.featArtistNames ? <span className="text-[var(--color-paper-400)]"> feat. {release.featArtistNames}</span> : null}
                </p>
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
                      <Link
                        href={`/${locale}/tracks/${release.slug}?track=${encodeURIComponent(track.slug)}&trackId=${track.id}`}
                        className="flex-1 truncate text-sm text-[var(--color-paper-200)] transition-colors hover:text-amber-300"
                        onClick={handleClose}
                      >
                        {track.title}
                      </Link>
                      <PlayTrackButton trackId={track.id} trackQueue={queue} locale={locale} size="small" />
                      <TrackShareButton trackSlug={track.slug} trackId={track.id} releaseSlug={release.slug} locale={locale} size="small" />
                      <TrackFavoriteButton trackId={track.id} isAuthenticated={isAuthenticated} locale={locale} size="small" />
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
