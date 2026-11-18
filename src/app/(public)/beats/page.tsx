import { BeatsContentSection } from "@/components/beats/beats-content-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { localizeBeats } from "@/lib/localize-content";
import { getBeatCatalog, getCatalogReactions } from "@/lib/beats/catalog";
import { normalizeBeatSearch } from "@/lib/beats/search";
import { parseBeatGenre } from "@/lib/beats/pagination";

export default async function BeatsPage({ searchParams }: { searchParams: Promise<{ page?: string; genre?: string; q?: string }> }) {
  const query = await searchParams;
  const genre = parseBeatGenre(query.genre);
  const search = normalizeBeatSearch(query.q);
  const locale = await getLocale();
  const t = dictionary[locale];
  const [catalog, session] = await Promise.all([getBeatCatalog(query.page, genre, search), getPublicSessionState()]);
  const [localizedBeats, carouselBeats, reactions] = await Promise.all([
    localizeBeats(catalog.beats, locale), localizeBeats(catalog.carousel, locale),
    getCatalogReactions(catalog.beats.map((beat) => beat.id), session.userId),
  ]);

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
      <BeatsContentSection beats={localizedBeats} carousel={carouselBeats} page={catalog.page} pages={catalog.pages} total={catalog.total} genre={genre} query={search} reactions={reactions} locale={locale} isAuthenticated={session.isAuthenticated} />
    </section>
  );
}
