import { BeatCard } from "@/components/beats/beat-card";
import { type Locale } from "@/lib/i18n";
import type { Beat } from "@/types";

export function BeatGrid({ beats, locale, isAuthenticated }: { beats: Beat[]; locale: Locale; isAuthenticated: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} queue={beats} locale={locale} isAuthenticated={isAuthenticated} />
      ))}
    </div>
  );
}