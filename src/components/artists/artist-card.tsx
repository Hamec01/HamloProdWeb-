import Link from "next/link";
import type { Artist } from "@/types";

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <article className="case-panel overflow-hidden p-4">
      <div className={`h-44 border border-[var(--color-line)] bg-gradient-to-br ${artist.coverPalette}`} />
      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Artist File</p>
        <h3 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{artist.artistName}</h3>
        <p className="text-sm text-[var(--color-paper-200)]">Track: {artist.trackTitle}</p>
        <p className="text-sm text-[var(--color-paper-400)]">Beat: {artist.beatTitle}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
        <Link href={artist.spotifyUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
          Spotify
        </Link>
        <Link href={artist.appleMusicUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
          Apple Music
        </Link>
        <Link href={artist.youtubeUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
          YouTube
        </Link>
      </div>
    </article>
  );
}