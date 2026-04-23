import Link from "next/link";
import Image from "next/image";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Artist } from "@/types";

export function ArtistPageHeader({ artist, locale }: { artist: Artist; locale: Locale }) {
  const t = dictionary[locale];

  return (
    <div className="relative">
      {/* Hero background */}
      <div className={`relative h-72 w-full overflow-hidden bg-gradient-to-br ${artist.coverPalette}`}>
        {artist.photoUrl ? (
          <Image
            src={artist.photoUrl}
            alt={artist.artistName}
            fill
            className="object-cover opacity-40"
            sizes="100vw"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ash-950)] via-[var(--color-ash-950)]/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-6 px-6 pb-6 sm:px-10">
          {/* Clickable artist photo */}
          <Link href={`/${locale}/artists/${artist.slug}/about`} className="group shrink-0">
            <div className="relative h-24 w-24 overflow-hidden border-2 border-[var(--color-line)] bg-[var(--color-ash-900)] transition-colors group-hover:border-amber-500 sm:h-32 sm:w-32">
              {artist.photoUrl ? (
                <Image src={artist.photoUrl} alt={artist.artistName} fill className="object-cover" sizes="128px" />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${artist.coverPalette}`} />
              )}
            </div>
          </Link>

          <div className="space-y-1">
            <h1 className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] drop-shadow sm:text-6xl">
              {artist.artistName}
            </h1>
            {artist.bio ? (
              <p className="line-clamp-2 text-sm text-[var(--color-paper-300)]">{artist.bio}</p>
            ) : null}
            <div className="flex gap-4 pt-1 text-xs uppercase tracking-[0.18em]">
              <Link
                href={`/${locale}/artists/${artist.slug}/about`}
                className="text-[var(--color-paper-300)] transition-colors hover:text-amber-400"
              >
                {t.artistAbout} →
              </Link>
              <Link
                href={`/${locale}/artists/${artist.slug}/music`}
                className="text-[var(--color-paper-300)] transition-colors hover:text-amber-400"
              >
                {t.artistMusic} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
