import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlayBeatButton } from "@/components/beats/play-beat-button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Beat } from "@/types";

export function BeatCard({ beat, queue }: { beat: Beat; queue: Beat[] }) {
  return (
    <article className="case-panel grain-border overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-paper-400)]">{beat.caseNumber}</p>
          <h3 className="mt-2 font-sans text-3xl uppercase leading-none tracking-[0.04em] text-[var(--color-paper-100)]">
            {beat.title}
          </h3>
        </div>
        <StatusBadge status={beat.status} />
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        {beat.mood} / {beat.bpm} BPM
      </p>

      {beat.coverImageUrl ? (
        <div
          className="case-artwork mt-4 h-44"
          style={{ backgroundImage: `url(${beat.coverImageUrl})` }}
        />
      ) : (
        <div className={`mt-4 h-44 border border-[var(--color-line)] bg-gradient-to-br ${beat.coverPalette}`} />
      )}

      <p className="mt-4 min-h-14 text-sm leading-6 text-[var(--color-paper-200)]">{beat.description}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <PlayBeatButton beat={beat} queue={queue} />
        <Link
          href={`/beats/${beat.slug}`}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          Open Case
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)]">
        <span>{beat.duration}</span>
        <span>${beat.priceUsd}</span>
      </div>
    </article>
  );
}