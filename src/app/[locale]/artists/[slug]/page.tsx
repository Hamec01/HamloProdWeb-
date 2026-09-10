import { notFound } from "next/navigation";
import { getArtistBySlug, getArtistReleases } from "@/services/content";
import { getAdminSessionState } from "@/lib/auth/session";
import { normalizeLocale } from "@/lib/market";
import { ArtistPageHeader } from "@/components/artists/artist-page-header";
import { ArtistReleasesCarousel } from "@/components/artists/artist-releases-carousel";
import { ArtistSocialLinks } from "@/components/artists/artist-social-links";
import { ArtistPlayerLoader } from "@/components/artists/artist-player-loader";
import { ArtistInlineAdminPanel } from "@/components/artists/artist-inline-admin-panel";
import type { PlayerQueueItem } from "@/store/player-store";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);

  const [artist, adminSession] = await Promise.all([
    getArtistBySlug(slug),
    getAdminSessionState(),
  ]);

  if (!artist) notFound();

  const releases = await getArtistReleases(artist.id, artist.artistName);

  // Build player queue from all release tracks
  const queue: PlayerQueueItem[] = releases.flatMap((release) =>
    release.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      slug: track.slug,
      previewUrl: track.mp3FilePath ?? "",
      kind: "track" as const,
      artistName: release.artistName,
    }))
  ).filter((t) => Boolean(t.previewUrl));

  return (
    <>
      {queue.length > 0 && <ArtistPlayerLoader tracks={queue} />}

      <div className="space-y-12">
        <ArtistPageHeader artist={artist} locale={locale} />

        {adminSession.isAuthenticated ? (
          <ArtistInlineAdminPanel artist={artist} locale={locale} />
        ) : null}

        {releases.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">
              {locale === "ru" ? "Релизы" : "Releases"}
            </h2>
            <ArtistReleasesCarousel
              releases={releases}
              locale={locale}
              artistSlug={artist.slug}
            />
          </section>
        )}

        <section>
          <ArtistSocialLinks artist={artist} locale={locale} />
        </section>
      </div>
    </>
  );
}
