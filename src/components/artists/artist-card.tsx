import Link from "next/link";
import Image from "next/image";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Artist } from "@/types";

export function ArtistCard({ artist, locale }: { artist: Artist; locale: Locale }) {
  const t = dictionary[locale];

  return (
    <article className="case-panel overflow-hidden">
      <Link href={`/${locale}/artists/${artist.slug}`} className="block">
        <div className={`relative h-52 overflow-hidden border-b border-[var(--color-line)] bg-gradient-to-br ${artist.coverPalette}`}>
          {artist.photoUrl ? (
            <Image src={artist.photoUrl} alt={artist.artistName} fill className="object-cover opacity-80 transition-opacity hover:opacity-100" sizes="(max-width: 640px) 100vw, 33vw" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <h3 className="absolute bottom-4 left-4 font-sans text-3xl uppercase tracking-[0.05em] text-white drop-shadow">{artist.artistName}</h3>
        </div>
      </Link>
      <div className="p-4 space-y-2">
        {artist.bio ? (
          <p className="text-sm text-[var(--color-paper-300)] line-clamp-2">{artist.bio}</p>
        ) : null}
        <p className="text-xs text-[var(--color-paper-400)]">{t.tracksEyebrow}: {artist.trackTitle}</p>
        <div className="pt-2 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
          {artist.spotifyUrl ? (
            <Link href={artist.spotifyUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
              Spotify
            </Link>
          ) : null}
          {artist.appleMusicUrl ? (
            <Link href={artist.appleMusicUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
              Apple Music
            </Link>
          ) : null}
          {artist.youtubeUrl ? (
            <Link href={artist.youtubeUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
              YouTube
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}