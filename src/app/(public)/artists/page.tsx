import { ArtistGrid } from "@/components/artists/artist-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { localizeArtists } from "@/lib/localize-content";
import { getArtists } from "@/services/content";

export default async function ArtistsPage() {
  const [artists, locale] = await Promise.all([getArtists(), getLocale()]);
  const t = dictionary[locale];
  const localizedArtists = await localizeArtists(artists, locale);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={t.artistsEyebrow}
        title={t.artistsTitle}
        description={t.artistsDesc}
      />
      <ArtistGrid artists={localizedArtists} locale={locale} />
    </section>
  );
}