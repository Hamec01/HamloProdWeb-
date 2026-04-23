import { notFound } from "next/navigation";
import Link from "next/link";
import { getArtistBySlug, getArtistReleases } from "@/services/content";
import { getPublicSessionState } from "@/lib/auth/session";
import { normalizeLocale } from "@/lib/market";
import { ReleaseCard } from "@/components/tracks/release-card";
import { CommentsSection } from "@/components/artists/comments-section";

export default async function ArtistMusicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);

  const [artist, session] = await Promise.all([
    getArtistBySlug(slug),
    getPublicSessionState(),
  ]);

  if (!artist) notFound();

  const releases = await getArtistReleases(artist.id, artist.artistName);

  return (
    <div className="space-y-12">
      <Link
        href={`/${locale}/artists/${artist.slug}`}
        className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)] transition-colors hover:text-[var(--color-paper-200)]"
      >
        ← {artist.artistName}
      </Link>

      <div className="space-y-2">
        <h1 className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">
          {artist.artistName}
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">
          {locale === "ru" ? "Вся музыка" : "All Music"} · {releases.length}
        </p>
      </div>

      {releases.length === 0 ? (
        <p className="text-sm text-[var(--color-paper-400)]">
          {locale === "ru" ? "Релизов пока нет." : "No releases yet."}
        </p>
      ) : (
        <ul className="space-y-16">
          {releases.map((release) => (
            <li key={release.id} className="space-y-6">
              <ReleaseCard
                release={release}
                isAuthenticated={session.isAuthenticated}
                locale={locale}
              />
              <CommentsSection
                entity="release"
                contentId={release.id}
                isAuthenticated={session.isAuthenticated}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
