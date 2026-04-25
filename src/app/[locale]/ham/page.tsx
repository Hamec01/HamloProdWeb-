import { HamContentSection } from "@/components/ham/ham-content-section";
import { HamPlayerQueueSync } from "@/components/tracks/ham-player-queue-sync";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getDemoTracks, getReleases, getSingleTracks } from "@/services/content";
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

  const [singles, releases, demoTracks, session] = await Promise.all([
    getSingleTracks(),
    getReleases(),
    getDemoTracks(),
    getPublicSessionState(),
  ]);

  const sortedSingles = [...singles].sort(sortSinglesNewest);
  const singlesOnly = sortedSingles;
  const demoSingles = [...demoTracks].sort(sortSinglesNewest);
  const sortedReleases = [...releases].sort(sortReleasesNewest);

  const hamQueueMap = new Map<string, PlayerTrack>();

  for (const track of singlesOnly) {
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
      <HamContentSection
        singles={singlesOnly}
        releases={sortedReleases}
        demoTracks={demoSingles}
        isAuthenticated={session.isAuthenticated}
        locale={locale}
      />
    </section>
  );
}
