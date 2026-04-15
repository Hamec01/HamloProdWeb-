import { TrackGrid } from "@/components/tracks/track-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getTracks } from "@/services/content";

export default async function SectorHamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const [tracks, session] = await Promise.all([getTracks(), getPublicSessionState()]);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].ham}
        title={locale === "ru" ? "Релизы HaM Hamilio" : "HaM Hamilio Releases"}
        description={locale === "ru" ? "Музыкальный сектор с отдельной витриной релизов." : "A dedicated release sector with its own storefront."}
      />
      <TrackGrid tracks={tracks} isAuthenticated={session.isAuthenticated} locale={locale} />
    </section>
  );
}
