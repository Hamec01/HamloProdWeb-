import { BEAT_GENRES, type BeatGenre } from "@/lib/beats-taxonomy";
import { normalizeBeatSearch } from "./search";

export const BEATS_PER_PAGE = 30;
export const CAROUSEL_BEATS = 12;

export function parseBeatGenre(value: string | undefined): BeatGenre | undefined {
  return BEAT_GENRES.find((genre) => genre === value);
}

export function beatPagination(rawPage: string | undefined, total: number) {
  const requested = Number(rawPage);
  const pages = Math.max(1, Math.ceil(total / BEATS_PER_PAGE));
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  return { page, pages, offset: (page - 1) * BEATS_PER_PAGE };
}

export function beatCatalogHref(page = 1, genre?: BeatGenre, query?: string) {
  const params = new URLSearchParams();
  if (genre) params.set("genre", genre);
  const search = normalizeBeatSearch(query);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/beats?${params}` : "/beats";
}

export type BeatReactionStats = { likes: number; dislikes: number; userReaction: "like" | "dislike" | null };
