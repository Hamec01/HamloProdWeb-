import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { localizeBeats } from "@/lib/localize-content";
import { getMarketContext, normalizeLocale, sectorLabels } from "@/lib/market";
import { getBeats } from "@/services/content";

export default async function SectorBeatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const market = getMarketContext(locale);
  const beats = await getBeats();
  const localizedBeats = await localizeBeats(beats, locale);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].beats}
        title={locale === "ru" ? "Каталог битов" : "Beat Storefront"}
        description={locale === "ru" ? `Рынок: RU / ${market.currency} / ${market.paymentProvider}` : `Market: Global / ${market.currency} / ${market.paymentProvider}`}
      />
      <BeatGrid beats={localizedBeats} locale={locale} hrefBase={`/${locale}/beats`} />
    </section>
  );
}
