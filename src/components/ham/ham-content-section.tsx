"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ReleaseCard } from "@/components/tracks/release-card";
import { TrackCard } from "@/components/tracks/track-card";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Release, Track } from "@/types";

type Tab = "default" | "singles" | "demo" | "albums";

type ShowcaseItem =
  | { kind: "single"; track: Track; title: string; subtitle: string; dateLabel: string; palette: string; imageUrl: string | null }
  | { kind: "release"; release: Release; title: string; subtitle: string; dateLabel: string; palette: string; imageUrl: string | null };

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function HamContentSection({
  singles,
  releases,
  demoTracks,
  isAuthenticated,
  locale,
}: {
  singles: Track[];
  releases: Release[];
  demoTracks: Track[];
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const t = dictionary[locale];
  const [tab, setTab] = useState<Tab>("default");
  const [modalItem, setModalItem] = useState<ShowcaseItem | null>(null);

  // Combined sorted items for carousel (singles + releases, no demos)
  const carouselItems = useMemo<ShowcaseItem[]>(() => {
    const combined: ShowcaseItem[] = [
      ...singles.map((track): ShowcaseItem => ({
        kind: "single",
        track,
        title: track.title,
        subtitle: locale === "ru" ? "Сингл" : "Single",
        dateLabel: track.releaseDate || track.createdAt,
        palette: track.coverPalette,
        imageUrl: track.coverImageUrl,
      })),
      ...releases.map((release): ShowcaseItem => ({
        kind: "release",
        release,
        title: release.title,
        subtitle: release.releaseType.toUpperCase(),
        dateLabel: release.releaseDate,
        palette: release.coverPalette,
        imageUrl: release.coverImageUrl,
      })),
    ];
    return combined.sort((a, b) => toTimestamp(b.dateLabel) - toTimestamp(a.dateLabel));
  }, [singles, releases, locale]);

  // Default grid — newest 9 items
  const defaultItems = useMemo(() => carouselItems.slice(0, 9), [carouselItems]);

  const tabClass = (t: Tab) =>
    `border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
      tab === t
        ? "border-amber-500 text-amber-300"
        : "border-[var(--color-line)] text-[var(--color-paper-200)] hover:border-amber-500/60 hover:text-amber-300/70"
    }`;

  const hasSingles = singles.length > 0;
  const hasDemos = demoTracks.length > 0;
  const hasReleases = releases.length > 0;

  return (
    <>
      {/* ─── Carousel ─── */}
      {carouselItems.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Карусель релизов" : "Releases Carousel"}
          </p>
          <div className="overflow-hidden border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] py-3">
            <div
              className="flex w-max gap-3 px-3"
              style={{
                animation: `ham-showcase-scroll ${Math.max(32, carouselItems.length * 3)}s linear infinite`,
              }}
            >
              {[...carouselItems, ...carouselItems].map((item, index) => (
                <button
                  key={`${item.kind}-${index}`}
                  type="button"
                  onClick={() => setModalItem(item)}
                  className="w-44 shrink-0 overflow-hidden border border-[var(--color-line)] bg-[rgba(12,11,9,0.7)] text-left transition-colors hover:border-amber-500/50"
                >
                  {item.imageUrl ? (
                    <div className="h-20 w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  ) : (
                    <div className={`h-20 w-full bg-gradient-to-br ${item.palette}`} />
                  )}
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{item.subtitle}</p>
                    <p className="truncate text-sm text-[var(--color-paper-100)]">{item.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <nav className="case-panel flex flex-wrap gap-3 p-4">
        <button type="button" onClick={() => setTab("default")} className={tabClass("default")}>
          {locale === "ru" ? "Все" : "All"}
        </button>
        {hasSingles && (
          <button type="button" onClick={() => setTab("singles")} className={tabClass("singles")}>
            {locale === "ru" ? "Синглы" : "Singles"}
          </button>
        )}
        <button type="button" onClick={() => setTab("demo")} className={tabClass("demo")}>
          {locale === "ru" ? "Демо" : "Demos"}
        </button>
        {hasReleases && (
          <button type="button" onClick={() => setTab("albums")} className={tabClass("albums")}>
            {locale === "ru" ? "Альбомы / EP / Mixtape" : "Albums / EP / Mixtape"}
          </button>
        )}
      </nav>

      {/* ─── Tab: Default (featured mix) ─── */}
      {tab === "default" && (
        <div className="space-y-6">
          {defaultItems.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {defaultItems.map((item) =>
                item.kind === "single" ? (
                  <TrackCard
                    key={item.track.id}
                    track={item.track}
                    trackQueue={singles}
                    isAuthenticated={isAuthenticated}
                    locale={locale}
                  />
                ) : (
                  <ReleaseCard
                    key={item.release.id}
                    release={item.release}
                    isAuthenticated={isAuthenticated}
                    locale={locale}
                  />
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-paper-400)]">
              {locale === "ru" ? "Релизы появятся здесь." : "Releases will appear here."}
            </p>
          )}
        </div>
      )}

      {/* ─── Tab: Singles ─── */}
      {tab === "singles" && (
        <div id="ham-singles" className="space-y-6 scroll-mt-24">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Синглы" : "Singles"}
          </p>
          {hasSingles ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {singles.map((track) => (
                <TrackCard key={track.id} track={track} trackQueue={singles} isAuthenticated={isAuthenticated} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-paper-400)]">{locale === "ru" ? "Синглов нет." : "No singles yet."}</p>
          )}
        </div>
      )}

      {/* ─── Tab: Demo ─── */}
      {tab === "demo" && (
        <div id="ham-demos" className="space-y-6 scroll-mt-24">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Демо" : "Demos"}
          </p>
          {hasDemos ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {demoTracks.map((track) => (
                <TrackCard key={track.id} track={track} trackQueue={demoTracks} isAuthenticated={isAuthenticated} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-paper-400)]">{locale === "ru" ? "Демо пока нет." : "No demos yet."}</p>
          )}
        </div>
      )}

      {/* ─── Tab: Albums ─── */}
      {tab === "albums" && (
        <div id="ham-albums" className="space-y-6 scroll-mt-24">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Альбомы / EP / Mixtape" : "Albums / EP / Mixtape"}
          </p>
          {hasReleases ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {releases.map((release) => (
                <ReleaseCard key={release.id} release={release} isAuthenticated={isAuthenticated} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-paper-400)]">{locale === "ru" ? "Альбомов нет." : "No albums yet."}</p>
          )}
        </div>
      )}

      {/* ─── Carousel modal: Release ─── */}
      {modalItem?.kind === "release" && (
        <ReleaseCard
          release={modalItem.release}
          isAuthenticated={isAuthenticated}
          locale={locale}
          initialOpen
          hideCompact
          onModalClose={() => setModalItem(null)}
        />
      )}

      {/* ─── Carousel modal: Single ─── */}
      {modalItem?.kind === "single" && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setModalItem(null)}
        >
          <div
            className="relative my-8 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalItem(null)}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center border border-[var(--color-line)] bg-[rgba(12,11,9,0.95)] text-[var(--color-paper-400)] transition-colors hover:text-[var(--color-paper-100)]"
              aria-label={locale === "ru" ? "Закрыть" : "Close"}
            >
              <X size={13} />
            </button>
            <TrackCard
              track={modalItem.track}
              trackQueue={singles}
              isAuthenticated={isAuthenticated}
              locale={locale}
            />
          </div>
        </div>
      )}
    </>
  );
}
