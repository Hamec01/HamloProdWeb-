import { ArtistGrid } from "@/components/artists/artist-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getArtists } from "@/services/content";

export default async function ArtistsPage() {
  const artists = await getArtists();

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="Artists"
        title="Artist Files"
        description="Public artist cards stay read-only. New artist records should eventually be created inside the admin panel."
      />
      <ArtistGrid artists={artists} />
    </section>
  );
}