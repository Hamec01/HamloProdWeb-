import { BeatsContentSection } from "@/components/beats/beats-content-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getBeats } from "@/services/content";

export default async function BeatsPage() {
  const locale = await getLocale();
  const t = dictionary[locale];
  const [beats, session] = await Promise.all([getBeats(), getPublicSessionState()]);

  return (
    <section className="space-y-8">
      <SectionHeading eyebrow={t.archiveEyebrow} title={t.beatsTitle} description={t.beatsDesc} />
      <BeatsContentSection beats={beats} locale={locale} isAuthenticated={session.isAuthenticated} />
    </section>
  );
}
