import { ArtistCard } from "@/components/artists/artist-card";
import { type Locale } from "@/lib/i18n";
import type { Artist } from "@/types";

export function ArtistGrid({ artists, locale }: { artists: Artist[]; locale: Locale }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {artists.map((artist) => (
        <ArtistCard key={artist.id} artist={artist} locale={locale} />
      ))}
    </div>
  );
}