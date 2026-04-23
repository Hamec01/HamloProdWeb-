import { HamPlayerQueueSync } from "@/components/tracks/ham-player-queue-sync";
import { TrackCard } from "@/components/tracks/track-card";
import { ReleaseCard } from "@/components/tracks/release-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getReleases, getSingleTracks } from "@/services/content";
import type { Release, Track } from "@/types";
import type { PlayerTrack } from "@/store/player-store";

function toHamQueueTrack(track: {
  id: string;
  title: string;
  slug: string;
  artistName: string;
}): PlayerTrack {
  return {
    id: track.id,
    title: track.title,
    slug: track.slug,
    previewUrl: "",
    kind: "track",
    artistName: track.artistName,
  };
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isDemoSingle(track: Track) {
  const source = `${track.title} ${track.slug}`.toLowerCase();
  return source.includes("demo");
}

function sortSinglesNewest(a: Track, b: Track) {
  const releaseDiff = toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
  if (releaseDiff !== 0) {
    return releaseDiff;
  }

  return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
}

function sortReleasesNewest(a: Release, b: Release) {
  const releaseDiff = toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate);
  if (releaseDiff !== 0) {
    return releaseDiff;
  }

  return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
}

export default async function SectorHamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  const [singles, releases, session] = await Promise.all([
    getSingleTracks(),
    getReleases(),
    getPublicSessionState(),
  ]);

  const sortedSingles = [...singles].sort(sortSinglesNewest);
  const demoSingles = sortedSingles.filter(isDemoSingle);
  const singlesOnly = sortedSingles.filter((track) => !isDemoSingle(track));
  const sortedReleases = [...releases].sort(sortReleasesNewest);

  const latestShowcase = [
    ...sortedSingles.map((track) => ({
      id: `single-${track.id}`,
      title: track.title,
      subtitle: locale === "ru" ? "Сингл" : "Single",
      dateLabel: track.releaseDate || track.createdAt,
      palette: track.coverPalette,
      imageUrl: track.coverImageUrl,
    })),
    ...sortedReleases.map((release) => ({
      id: `release-${release.id}`,
      title: release.title,
      subtitle: release.releaseType.toUpperCase(),
      dateLabel: release.releaseDate,
      palette: release.coverPalette,
      imageUrl: release.coverImageUrl,
    })),
  ]
    .sort((a, b) => toTimestamp(b.dateLabel) - toTimestamp(a.dateLabel))
    .slice(0, 14);

  const hasLatest = latestShowcase.length > 0;
  const hasSingles = singlesOnly.length > 0;
  const hasDemos = demoSingles.length > 0;
  const hasReleases = sortedReleases.length > 0;
  const hamQueueMap = new Map<string, PlayerTrack>();

  for (const track of singles) {
    hamQueueMap.set(track.id, toHamQueueTrack(track));
  }

  for (const release of sortedReleases) {
    for (const track of release.tracks) {
      hamQueueMap.set(
        track.id,
        toHamQueueTrack({
          id: track.id,
          title: track.title,
          slug: track.slug,
          artistName: release.artistName,
        }),
      );
    }
  }

  const hamQueue = Array.from(hamQueueMap.values());

  return (
    <section className="space-y-16">
      <HamPlayerQueueSync queue={hamQueue} />
      <SectionHeading
        eyebrow={sectorLabels[locale].ham}
        title={locale === "ru" ? "Релизы HaM Hamilio" : "HaM Hamilio Releases"}
        description={
          locale === "ru"
            ? "Музыкальный сектор: синглы, EP, альбомы и mixtape."
            : "Music sector: singles, EPs, albums and mixtapes."
        }
      />

      {hasLatest && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Карусель релизов" : "Releases Carousel"}
          </p>
          <div className="overflow-hidden border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] py-3">
            <div
              className="flex w-max gap-3 px-3"
              style={{
                animation: `ham-showcase-scroll ${Math.max(32, latestShowcase.length * 3)}s linear infinite`,
              }}
            >
              {[...latestShowcase, ...latestShowcase].map((item, index) => (
                <article key={`${item.id}-${index}`} className="w-44 shrink-0 overflow-hidden border border-[var(--color-line)] bg-[rgba(12,11,9,0.7)]">
                  {item.imageUrl ? (
                    <div className="h-20 w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                  ) : (
                    <div className={`h-20 w-full bg-gradient-to-br ${item.palette}`} />
                  )}
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{item.subtitle}</p>
                    <p className="truncate text-sm text-[var(--color-paper-100)]">{item.title}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="case-panel flex flex-wrap gap-3 p-4">
        <a href="#ham-singles" className="border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-300">
          {locale === "ru" ? "Синглы" : "Singles"}
        </a>
        <a href="#ham-demos" className="border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-300">
          {locale === "ru" ? "Демо" : "Demos"}
        </a>
        <a href="#ham-albums" className="border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-300">
          {locale === "ru" ? "Альбомы / EP / Mixtape" : "Albums / EP / Mixtape"}
        </a>
      </nav>

      {/* ── Синглы ── */}
      {hasSingles && (
        <div id="ham-singles" className="space-y-6 scroll-mt-24">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Синглы" : "Singles"}
          </p>
          <div className="grid gap-6 lg:grid-cols-3">
            {singlesOnly.map((track) => (
              <TrackCard key={track.id} track={track} trackQueue={singlesOnly} isAuthenticated={session.isAuthenticated} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {/* ── Демо ── */}
      <div id="ham-demos" className="space-y-6 scroll-mt-24">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
          {locale === "ru" ? "Демо" : "Demos"}
        </p>
        {hasDemos ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {demoSingles.map((track) => (
              <TrackCard key={track.id} track={track} trackQueue={demoSingles} isAuthenticated={session.isAuthenticated} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-paper-400)]">
            {locale === "ru" ? "Демо пока нет." : "No demos yet."}
          </p>
        )}
      </div>

      {/* ── Альбомы / EP / Mixtape ── */}
      {hasReleases && (
        <div id="ham-albums" className="space-y-6 scroll-mt-24">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Альбомы / EP / Mixtape" : "Albums / EP / Mixtape"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedReleases.map((release) => (
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

      <style>{`
        @keyframes ham-showcase-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

