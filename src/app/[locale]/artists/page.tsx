import { AdminArtistCrudManager } from "@/components/admin/admin-artist-crud-manager";
import { ArtistGrid } from "@/components/artists/artist-grid";
import { getAdminSessionState } from "@/lib/auth/session";
import { SectionHeading } from "@/components/ui/section-heading";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getAdminArtists, getArtists } from "@/services/content";

export default async function SectorArtistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const [artists, adminSession] = await Promise.all([getArtists(), getAdminSessionState()]);
  const adminArtists = adminSession.isAuthenticated ? await getAdminArtists() : [];

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].artists}
        title={locale === "ru" ? "Артисты HamloProd" : "HamloProd Artists"}
        description={locale === "ru" ? "Отдельная витрина артистов без перемешивания с остальными секторами." : "A dedicated artist storefront, separated from the other sectors."}
      />
      <ArtistGrid artists={artists} locale={locale} />

      {adminSession.isAuthenticated ? (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Управление артистами (admin)" : "Artist Management (admin)"}
          </p>
          <AdminArtistCrudManager artists={adminArtists} hasSupabase={false} />
        </section>
      ) : null}
    </section>
  );
}
