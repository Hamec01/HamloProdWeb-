import { BeatCard } from "@/components/beats/beat-card";
import { type Locale } from "@/lib/i18n";
import type { Beat } from "@/types";

export function BeatGrid({ beats, locale }: { beats: Beat[]; locale: Locale }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} queue={beats} locale={locale} />
      ))}
    </div>
  );
}