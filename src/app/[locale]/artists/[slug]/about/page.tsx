import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getArtistBySlug, getArtistPosts } from "@/services/content";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { normalizeLocale } from "@/lib/market";
import { ArtistNewsFeed } from "@/components/artists/artist-news-feed";
import { dictionary } from "@/lib/i18n";

export default async function ArtistAboutPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = dictionary[locale];

  const [artist, session] = await Promise.all([
    getArtistBySlug(slug),
    getPublicSessionState(),
  ]);

  if (!artist) notFound();

  const posts = await getArtistPosts(artist.id);

  const isOwner = Boolean(session.artistId && session.artistId === artist.id);

  return (
    <div className="space-y-12">
      {/* Back link */}
      <Link
        href={`/${locale}/artists/${artist.slug}`}
        className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)] transition-colors hover:text-[var(--color-paper-200)]"
      >
        ← {artist.artistName}
      </Link>

      {/* Bio block */}
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        {artist.photoUrl && (
          <div className="relative h-64 w-64 shrink-0 overflow-hidden border border-[var(--color-line)]">
            <Image
              src={artist.photoUrl}
              alt={artist.artistName}
              fill
              className="object-cover"
              sizes="256px"
              priority
            />
          </div>
        )}
        <div className="space-y-4">
          <h1 className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">
            {artist.artistName}
          </h1>
          {artist.bio ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-paper-300)]">
              {artist.bio}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-paper-500)]">
              {locale === "ru" ? "Биография не добавлена." : "No biography yet."}
            </p>
          )}
        </div>
      </div>

      {/* News feed */}
      <ArtistNewsFeed
        artistId={artist.id}
        initialPosts={posts}
        isOwner={isOwner}
        isAuthenticated={session.isAuthenticated}
        locale={locale}
      />
    </div>
  );
}
