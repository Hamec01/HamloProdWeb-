"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BeatGrid } from "@/components/beats/beat-grid";
import { BEAT_GENRES, getGenreLabel, type BeatGenre } from "@/lib/beats-taxonomy";
import type { Locale } from "@/lib/i18n";
import type { Beat } from "@/types";

type GenreTab = "all" | BeatGenre;

export function BeatsContentSection({
  beats,
  locale,
  isAuthenticated,
}: {
  beats: Beat[];
  locale: Locale;
  isAuthenticated: boolean;
}) {
  const [tab, setTab] = useState<GenreTab>("all");

  const sortedBeats = useMemo(
    () => [...beats].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [beats],
  );

  const filteredBeats = useMemo(
    () => (tab === "all" ? sortedBeats : sortedBeats.filter((beat) => beat.genre === tab)),
    [sortedBeats, tab],
  );

  const carouselBeats = useMemo(() => [...sortedBeats, ...sortedBeats], [sortedBeats]);

  const tabClass = (value: GenreTab) =>
    `border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
      tab === value
        ? "border-amber-500 text-amber-300"
        : "border-[var(--color-line)] text-[var(--color-paper-200)] hover:border-amber-500/60 hover:text-amber-300/70"
    }`;

  return (
    <div className="space-y-8">
      {sortedBeats.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Карусель битов" : "Beats Carousel"}
          </p>
          <div className="overflow-hidden border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] py-3">
            <div
              className="flex w-max gap-3 px-3"
              style={{ animation: `ham-showcase-scroll ${Math.max(30, sortedBeats.length * 2.8)}s linear infinite` }}
            >
              {carouselBeats.map((beat, index) => (
                <Link
                  key={`${beat.id}-${index}`}
                  href={`/beats/${beat.slug}`}
                  className="w-44 shrink-0 overflow-hidden border border-[var(--color-line)] bg-[rgba(12,11,9,0.75)] text-left transition-colors hover:border-amber-500/60"
                >
                  {beat.coverImageUrl ? (
                    <div className="h-20 w-full bg-cover bg-center" style={{ backgroundImage: `url(${beat.coverImageUrl})` }} />
                  ) : (
                    <div className={`h-20 w-full bg-gradient-to-br ${beat.coverPalette}`} />
                  )}
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">
                      {getGenreLabel(beat.genre, locale)} / {beat.substyle}
                    </p>
                    <p className="truncate text-sm text-[var(--color-paper-100)]">{beat.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="case-panel flex flex-wrap gap-3 p-4">
        <button type="button" className={tabClass("all")} onClick={() => setTab("all")}>
          {locale === "ru" ? "Все" : "All"}
        </button>
        {BEAT_GENRES.map((genre) => (
          <button key={genre} type="button" className={tabClass(genre)} onClick={() => setTab(genre)}>
            {getGenreLabel(genre, locale)}
          </button>
        ))}
      </nav>

      {filteredBeats.length > 0 ? (
        <BeatGrid beats={filteredBeats} locale={locale} hrefBase="/beats" isAuthenticated={isAuthenticated} />
      ) : (
        <p className="text-sm text-[var(--color-paper-400)]">
          {locale === "ru" ? "В этом разделе пока нет битов." : "No beats in this section yet."}
        </p>
      )}
    </div>
  );
}
