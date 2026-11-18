import Link from "next/link";
import Image from "next/image";
import { BeatCatalogSearch } from "./beat-catalog-search";
import { BeatGrid } from "@/components/beats/beat-grid";
import { BEAT_GENRES, getGenreLabel, type BeatGenre } from "@/lib/beats-taxonomy";
import { BEATS_PER_PAGE, beatCatalogHref, type BeatReactionStats } from "@/lib/beats/pagination";
import type { Locale } from "@/lib/i18n";
import type { Beat } from "@/types";
import { beatCoverSrc } from "@/lib/beats/cover-src";

type Props = {
  beats: Beat[];
  carousel: Beat[];
  page: number;
  pages: number;
  total: number;
  genre?: BeatGenre;
  query: string;
  reactions: Record<string, BeatReactionStats>;
  locale: Locale;
  isAuthenticated: boolean;
};

export function BeatsContentSection({ beats, carousel, page, pages, total, genre, query, reactions, locale, isAuthenticated }: Props) {
  const carouselBeats = [...carousel, ...carousel];
  const tabClass = (value?: BeatGenre) => `border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
    genre === value ? "border-amber-500 text-amber-300" : "border-[var(--color-line)] text-[var(--color-paper-200)] hover:border-amber-500/60 hover:text-amber-300/70"
  }`;
  return (
    <div className="space-y-8">
      {carousel.length ? (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">{locale === "ru" ? "Карусель битов" : "Beats Carousel"}</p>
          <div className="overflow-hidden border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] py-3">
            <div className="flex w-max gap-3 px-3" style={{ animation: `ham-showcase-scroll ${Math.max(30, carousel.length * 2.8)}s linear infinite` }}>
              {carouselBeats.map((beat, index) => (
                <Link key={`${beat.id}-${index}`} href={`/beats/${beat.slug}`} prefetch={false} data-carousel-beat={beat.id} className="w-44 shrink-0 overflow-hidden border border-[var(--color-line)] bg-[rgba(12,11,9,0.75)] text-left transition-colors hover:border-amber-500/60">
                  {beat.coverImageUrl ? (
                    <div className="relative h-20 w-full overflow-hidden"><Image src={beatCoverSrc(beat)} alt="" fill sizes="176px" quality={60} className="object-cover" /></div>
                  ) : <div className={`h-20 w-full bg-gradient-to-br ${beat.coverPalette}`} />}
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{getGenreLabel(beat.genre, locale)} / {beat.substyle}</p>
                    <p className="truncate text-sm text-[var(--color-paper-100)]">{beat.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="case-panel flex flex-col gap-5 p-4 xl:flex-row xl:items-end">
      <nav className="flex flex-1 flex-wrap gap-3" aria-label={locale === "ru" ? "Жанры" : "Genres"}>
        <Link href={beatCatalogHref(1, undefined, query)} prefetch={false} className={tabClass()} aria-current={!genre ? "page" : undefined}>{locale === "ru" ? "Все" : "All"}</Link>
        {BEAT_GENRES.map((value) => <Link key={value} href={beatCatalogHref(1, value, query)} prefetch={false} className={tabClass(value)} aria-current={genre === value ? "page" : undefined}>{getGenreLabel(value, locale)}</Link>)}
      </nav>
      <BeatCatalogSearch query={query} genre={genre} locale={locale} />
      </div>
      {query ? <p role="status" className="text-sm text-stone-300">{locale === "ru" ? "Найдено битов" : "Beats found"}: {total}</p> : null}
      {beats.length ? <div data-beat-catalog><BeatGrid beats={beats} reactions={reactions} locale={locale} hrefBase="/beats" isAuthenticated={isAuthenticated} /></div> : <p className="text-sm text-[var(--color-paper-400)]">{locale === "ru" ? query ? "Биты не найдены. Попробуйте другое название или номер CASE." : "В этом разделе пока нет битов." : query ? "No beats found. Try another title or CASE number." : "No beats in this section yet."}</p>}
      {total > 0 ? <p className="text-xs text-[var(--color-paper-400)]">{locale === "ru" ? "Показано" : "Showing"} {(page - 1) * BEATS_PER_PAGE + 1}–{(page - 1) * BEATS_PER_PAGE + beats.length} {locale === "ru" ? "из" : "of"} {total}</p> : null}
      {pages > 1 ? <nav aria-label={locale === "ru" ? "Страницы каталога" : "Catalogue pages"} className="flex flex-wrap gap-2">
        {Array.from({ length: pages }, (_, index) => index + 1).map((value) => <Link key={value} href={beatCatalogHref(value, genre, query)} prefetch={false} aria-current={value === page ? "page" : undefined} className={`flex h-11 min-w-11 items-center justify-center border px-3 text-sm ${value === page ? "border-amber-500 text-amber-300" : "border-[var(--color-line)] text-[var(--color-paper-200)] hover:border-amber-500/60"}`}>{value}</Link>)}
      </nav> : null}
    </div>
  );
}
