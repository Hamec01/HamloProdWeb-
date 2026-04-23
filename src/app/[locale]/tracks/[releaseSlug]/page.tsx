import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale } from "@/lib/market";
import { getReleases } from "@/services/content";
import type { Release } from "@/types";
import { TrackFavoriteButton } from "@/components/tracks/track-favorite-button";
import { TrackDownloadButton } from "@/components/tracks/track-download-button";
import { PlayTrackButton } from "@/components/tracks/play-track-button";

type ReleaseTrackPageParams = {
  params: Promise<{ locale: string; releaseSlug: string }>;
  searchParams: Promise<{ track?: string }>;
};

export default async function ReleaseTrackPage({ params, searchParams }: ReleaseTrackPageParams) {
  const { locale: rawLocale, releaseSlug } = await params;
  const { track: trackSlug } = await searchParams;

  const locale = normalizeLocale(rawLocale);
  if (!trackSlug) {
    notFound();
  }

  const releases = await getReleases();
  const release = releases.find((r) => r.slug === releaseSlug) as Release | undefined;

  if (!release) {
    notFound();
  }

  const track = release.tracks.find((t) => t.slug === trackSlug);

  if (!track) {
    notFound();
  }

  const session = await getPublicSessionState();

  return (
    <div className="space-y-8">
      {/* Header link back */}
      <Link
        href={`/${locale}/tracks/${release.slug}`}
        className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)] transition-colors hover:text-[var(--color-paper-200)]"
      >
        ← {locale === "ru" ? "Вернуться к релизу" : "Back to Release"}
      </Link>

      {/* Cover and Release Info */}
      <div className="case-panel overflow-hidden">
        {release.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={release.coverImageUrl}
            alt={release.title}
            className="block w-full"
          />
        ) : (
          <div className={`h-72 w-full bg-gradient-to-br ${release.coverPalette}`} />
        )}

        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
              {release.releaseType.toUpperCase()} / {release.releaseDate}
            </p>
            <h1 className="font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
              {release.title}
            </h1>
            <p className="text-sm text-[var(--color-paper-200)]">
              {release.artistName}
              {release.featArtistNames ? <span className="text-[var(--color-paper-400)]"> feat. {release.featArtistNames}</span> : null}
            </p>
            {release.description ? (
              <p className="pt-2 text-sm leading-6 text-[var(--color-paper-400)]">{release.description}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Single Track */}
      <article className="case-panel p-6 space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Трек" : "Track"}
          </p>
          <h2 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
            {track.title}
          </h2>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 pt-2">
          <PlayTrackButton
            trackId={track.id}
            trackQueue={release.tracks.map((tr) => ({
              id: tr.id,
              title: tr.title,
              slug: tr.slug,
              artistName: release.artistName,
              hasMp3: Boolean(tr.mp3FilePath),
            }))}
            locale={locale}
          />
          <TrackDownloadButton
            trackId={track.id}
            isAuthenticated={session.isAuthenticated}
            isAvailable={Boolean(track.mp3FilePath)}
            locale={locale}
          />
          <TrackFavoriteButton
            trackId={track.id}
            isAuthenticated={session.isAuthenticated}
            locale={locale}
          />
        </div>
      </article>

      {/* Other tracks in release */}
      {release.tracks.length > 1 && (
        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
              {locale === "ru" ? "Другие треки в релизе" : "Other Tracks in Release"}
            </p>
            <h3 className="mt-2 font-sans text-2xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
              {release.title}
            </h3>
          </div>

          <ol className="space-y-2 border border-[var(--color-line)] p-4">
            {release.tracks.map((tr) => (
              <li key={tr.id} className="flex items-center gap-2">
                <span className="shrink-0 w-5 text-right text-xs text-[var(--color-paper-400)]">
                  {tr.trackNumber}.
                </span>
                <Link
                  href={`/${locale}/tracks/${release.slug}?track=${tr.slug}`}
                  className={`flex-1 truncate text-sm transition-colors ${
                    tr.id === track.id
                      ? "font-semibold text-amber-400"
                      : "text-[var(--color-paper-200)] hover:text-amber-300"
                  }`}
                >
                  {tr.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
