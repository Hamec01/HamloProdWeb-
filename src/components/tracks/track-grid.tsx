import { TrackCard } from "@/components/tracks/track-card";
import type { Track } from "@/types";

export function TrackGrid({ tracks }: { tracks: Track[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  );
}