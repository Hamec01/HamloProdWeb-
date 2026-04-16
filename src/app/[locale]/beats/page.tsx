import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { dictionary } from "@/lib/i18n";
import { normalizeLocale } from "@/lib/market";
import { getBeats } from "@/services/content";

export default async function SectorBeatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = dictionary[locale];
  const beats = await getBeats();

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
      <BeatGrid beats={beats} locale={locale} hrefBase={`/${locale}/beats`} />
    </section>
  );
}
