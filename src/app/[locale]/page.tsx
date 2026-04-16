import { LanguageGateway } from "@/components/landing/language-gateway";
import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { normalizeLocale } from "@/lib/market";
import { dictionary } from "@/lib/i18n";
import { getBeats } from "@/services/content";

export default async function LocaleLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = dictionary[locale];
  const beats = await getBeats();
  const visibleBeats = beats.slice(0, 2);

  return (
    <>
      <LanguageGateway locale={locale} />

      <section className="space-y-8">
        <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
        <BeatGrid beats={visibleBeats} locale={locale} hrefBase="/beats" />
      </section>
    </>
  );
}
