import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { localizeBeats } from "@/lib/localize-content";
import { getBeats } from "@/services/content";

export default async function BeatsPage() {
  const [beats, locale] = await Promise.all([getBeats(), getLocale()]);
  const t = dictionary[locale];
  const localizedBeats = await localizeBeats(beats, locale);

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
      <BeatGrid beats={localizedBeats} locale={locale} />
    </section>
  );
}
