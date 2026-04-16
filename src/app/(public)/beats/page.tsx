import { BeatGrid } from "@/components/beats/beat-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getBeats } from "@/services/content";

export default async function BeatsPage() {
  const locale = await getLocale();
  const t = dictionary[locale];
  const beats = await getBeats();

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
      <BeatGrid beats={beats} locale={locale} hrefBase="/beats" />
    </section>
  );
}
