import { TrackGrid } from "@/components/tracks/track-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getTracks } from "@/services/content";

export default async function TracksPage() {
  const [tracks, session, locale] = await Promise.all([getTracks(), getPublicSessionState(), getLocale()]);
  const t = dictionary[locale];

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={t.tracksEyebrow}
        title={t.tracksTitle}
        description={t.tracksDesc}
      />
      <TrackGrid tracks={tracks} isAuthenticated={session.isAuthenticated} locale={locale} />
    </section>
  );
}