import { BeatCard } from "@/components/beats/beat-card";
import { type Locale } from "@/lib/i18n";
import type { Beat } from "@/types";
import type { BeatReactionStats } from "@/lib/beats/pagination";

export function BeatGrid({
  beats,
  locale,
  hrefBase = "/beats",
  isAuthenticated,
  reactions,
}: {
  beats: Beat[];
  locale: Locale;
  hrefBase?: string;
  isAuthenticated: boolean;
  reactions?: Record<string, BeatReactionStats>;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} queue={beats} locale={locale} hrefBase={hrefBase} isAuthenticated={isAuthenticated} initialReactionStats={reactions?.[beat.id]} />
      ))}
    </div>
  );
}
