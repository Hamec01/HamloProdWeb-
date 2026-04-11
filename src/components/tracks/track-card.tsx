import Link from "next/link";
import { TrackDownloadButton } from "@/components/tracks/track-download-button";
import type { Track } from "@/types";

export function TrackCard({ track, isAuthenticated }: { track: Track; isAuthenticated: boolean }) {
  return (
    <article className="case-panel overflow-hidden p-4">
      {track.coverImageUrl ? (
        <div
          className="case-artwork h-44"
          style={{ backgroundImage: `url(${track.coverImageUrl})` }}
        />
      ) : (
        <div className={`h-44 border border-[var(--color-line)] bg-gradient-to-br ${track.coverPalette}`} />
      )}
      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Release / {track.releaseDate}</p>
        <h3 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{track.title}</h3>
        <p className="text-sm text-[var(--color-paper-200)]">{track.artistName}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
        {track.spotifyUrl ? (
          <Link href={track.spotifyUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            Spotify
          </Link>
        ) : null}
        {track.appleMusicUrl ? (
          <Link href={track.appleMusicUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            Apple Music
          </Link>
        ) : null}
        {track.youtubeUrl ? (
          <Link href={track.youtubeUrl} target="_blank" className="border border-[var(--color-line)] px-3 py-2 hover:bg-[rgba(255,255,255,0.04)]">
            YouTube
          </Link>
        ) : null}
        <TrackDownloadButton trackId={track.id} isAuthenticated={isAuthenticated} isAvailable={Boolean(track.mp3FilePath)} />
      </div>
    </article>
  );
}