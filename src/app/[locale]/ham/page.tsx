import { TrackCard } from "@/components/tracks/track-card";
import { ReleaseCard } from "@/components/tracks/release-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getReleases, getSingleTracks } from "@/services/content";

export default async function SectorHamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const [singles, releases, session] = await Promise.all([
    getSingleTracks(),
    getReleases(),
    getPublicSessionState(),
  ]);

  // Latest = 4 most recently added singles
  const latest = [...singles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ).slice(0, 4);

  const hasLatest = latest.length > 0;
  const hasSingles = singles.length > 0;
  const hasReleases = releases.length > 0;

  return (
    <section className="space-y-16">
      <SectionHeading
        eyebrow={sectorLabels[locale].ham}
        title={locale === "ru" ? "Релизы HaM Hamilio" : "HaM Hamilio Releases"}
        description={
          locale === "ru"
            ? "Музыкальный сектор: синглы, EP, альбомы и mixtape."
            : "Music sector: singles, EPs, albums and mixtapes."
        }
      />

      {/* ── Последнее добавленное ── */}
      {hasLatest && (
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Последнее добавленное" : "Latest"}
          </p>
          <div className="grid gap-6 lg:grid-cols-4">
            {latest.map((track) => (
              <TrackCard key={track.id} track={track} isAuthenticated={session.isAuthenticated} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* ── Синглы ── */}
      {hasSingles && (
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Синглы / Релизы" : "Singles / Releases"}
          </p>
          <div className="grid gap-6 lg:grid-cols-3">
            {singles.map((track) => (
              <TrackCard key={track.id} track={track} isAuthenticated={session.isAuthenticated} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* ── Альбомы / EP / Mixtape ── */}
      {hasReleases && (
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Альбомы / EP / Mixtape" : "Albums / EP / Mixtape"}
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            {releases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                isAuthenticated={session.isAuthenticated}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}

      {!hasLatest && !hasReleases && (
        <p className="text-sm text-[var(--color-paper-400)]">
          {locale === "ru" ? "Релизы появятся здесь." : "Releases will appear here."}
        </p>
      )}
    </section>
  );
}

