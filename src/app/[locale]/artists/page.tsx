import { ArtistGrid } from "@/components/artists/artist-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getArtists } from "@/services/content";

export default async function SectorArtistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const artists = await getArtists();

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].artists}
        title={locale === "ru" ? "Артисты HamloProd" : "HamloProd Artists"}
        description={locale === "ru" ? "Отдельная витрина артистов без перемешивания с остальными секторами." : "A dedicated artist storefront, separated from the other sectors."}
      />
      <ArtistGrid artists={artists} locale={locale} />
    </section>
  );
}
