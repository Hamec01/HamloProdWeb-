import { ArtistCard } from "@/components/artists/artist-card";
import type { Artist } from "@/types";

export function ArtistGrid({ artists }: { artists: Artist[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {artists.map((artist) => (
        <ArtistCard key={artist.id} artist={artist} />
      ))}
    </div>
  );
}