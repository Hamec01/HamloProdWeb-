import { TrackCard } from "@/components/tracks/track-card";
import { type Locale } from "@/lib/i18n";
import type { Track } from "@/types";

export function TrackGrid({ tracks, isAuthenticated, locale }: { tracks: Track[]; isAuthenticated: boolean; locale: Locale }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} isAuthenticated={isAuthenticated} locale={locale} />
      ))}
    </div>
  );
}