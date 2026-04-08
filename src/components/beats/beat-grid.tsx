import { BeatCard } from "@/components/beats/beat-card";
import type { Beat } from "@/types";

export function BeatGrid({ beats }: { beats: Beat[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {beats.map((beat) => (
        <BeatCard key={beat.id} beat={beat} queue={beats} />
      ))}
    </div>
  );
}