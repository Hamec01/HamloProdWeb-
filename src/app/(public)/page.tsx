import { LanguageGateway } from "@/components/landing/language-gateway";
import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getLocale } from "@/lib/i18n-server";
import { dictionary } from "@/lib/i18n";
import { getBeats } from "@/services/content";

export default async function HomePage() {
  const locale = await getLocale();
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