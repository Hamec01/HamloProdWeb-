"use client";

import { useEffect, useId, useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { beatCatalogHref } from "@/lib/beats/pagination";
import type { BeatGenre } from "@/lib/beats-taxonomy";
import { normalizeBeatSearch } from "@/lib/beats/search";

export function BeatCatalogSearch({ query, genre, locale }: { query: string; genre?: BeatGenre; locale: "ru" | "en" }) {
  const router = useRouter(), id = useId();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requested = useRef(query);
  const previousGenre = useRef(genre);
  const input = useRef<HTMLInputElement>(null);
  const ru = locale === "ru";
  useEffect(() => {
    // Preserve newer typing when a previous search response arrives. Sync Back
    // and genre navigation to the URL instead of restoring an old local query.
    if (query !== requested.current || genre !== previousGenre.current) {
      if (timer.current) clearTimeout(timer.current);
      requested.current = query;
      if (input.current) input.current.value = query;
    }
    previousGenre.current = genre;
  }, [query, genre]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function search(text: string) {
    if (timer.current) clearTimeout(timer.current);
    const next = normalizeBeatSearch(text);
    requested.current = next;
    startTransition(() => router.replace(beatCatalogHref(1, genre, next), { scroll: false }));
  }
  function submit(event: FormEvent) { event.preventDefault(); search(input.current?.value || ""); }
  return <form role="search" action="/beats" method="get" onSubmit={submit} className="w-full shrink-0 space-y-2 xl:w-80">
    {genre ? <input type="hidden" name="genre" value={genre} /> : null}
    <label htmlFor={id} className="block text-xs uppercase tracking-[0.12em] text-stone-300">{ru ? "Поиск битов" : "Search beats"}</label>
    <div className="flex min-w-0 items-center border border-stone-600 bg-black/40 focus-within:border-amber-500">
      <input ref={input} id={id} type="search" name="q" maxLength={120} autoComplete="off" placeholder={ru ? "Название или CASE-068" : "Title or CASE-068"} defaultValue={query} onChange={(event) => {
        const next = event.target.value;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => search(next), 350);
      }} className="peer min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-stone-100 outline-none [&::-webkit-search-cancel-button]:hidden" />
      <button type="button" aria-label={ru ? "Очистить поиск" : "Clear search"} onClick={() => { if (input.current) input.current.value = ""; search(""); input.current?.focus(); }} className="flex h-11 w-10 peer-placeholder-shown:invisible shrink-0 items-center justify-center text-stone-300 hover:text-white"><X size={16} aria-hidden="true" /></button>
      <button type="submit" aria-label={ru ? "Найти бит" : "Find beat"} className="flex h-11 w-11 shrink-0 items-center justify-center border-l border-stone-600 text-amber-200 hover:bg-amber-950/30"><Search size={18} aria-hidden="true" /></button>
    </div>
    {pending ? <p role="status" className="text-xs text-stone-400">{ru ? "Ищем…" : "Searching…"}</p> : null}
  </form>;
}
