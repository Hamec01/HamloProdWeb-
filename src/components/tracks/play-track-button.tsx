"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";
import { usePlayerStore } from "@/store/player-store";
import type { PlayerTrack } from "@/store/player-store";

export type TrackQueueItem = {
  id: string;
  title: string;
  slug: string;
  artistName?: string;
  hasMp3: boolean;
};

async function fetchStreamUrl(trackId: string): Promise<string> {
  const res = await fetch(`/api/tracks/${trackId}/stream`);
  if (!res.ok) return "";
  const data = (await res.json()) as { url?: string };
  return data.url ?? "";
}

export function PlayTrackButton({
  trackId,
  trackQueue,
  locale,
  size = "normal",
}: {
  trackId: string;
  trackQueue: TrackQueueItem[];
  locale: Locale;
  size?: "normal" | "small";
}) {
  const t = dictionary[locale];
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  const [isLoading, setIsLoading] = useState(false);

  const isActive = currentTrack?.id === trackId;
  const isActiveAndPlaying = isActive && isPlaying;

  const queueHasMp3 = trackQueue.find((t) => t.id === trackId)?.hasMp3 ?? false;

  const handleClick = async () => {
    if (isActiveAndPlaying) {
      pause();
      return;
    }

    // If same track but paused — just resume via play (it stays in queue)
    if (isActive && currentTrack) {
      play(currentTrack, undefined);
      return;
    }

    if (!queueHasMp3) return;

    setIsLoading(true);
    try {
      // Fetch stream URLs for all tracks in the queue that have an mp3
      const playerItems = await Promise.all(
        trackQueue.map(async (t): Promise<PlayerTrack> => {
          const url = t.hasMp3 ? await fetchStreamUrl(t.id) : "";
          return {
            id: t.id,
            title: t.title,
            slug: t.slug,
            previewUrl: url,
            kind: "track",
            artistName: t.artistName,
          };
        }),
      );

      const startIndex = playerItems.findIndex((i) => i.id === trackId);
      const target = playerItems[startIndex >= 0 ? startIndex : 0];
      if (target && target.previewUrl) {
        play(target, playerItems);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (size === "small") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || !queueHasMp3}
        className="flex h-8 w-8 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={isActiveAndPlaying ? t.pause : t.play}
      >
        {isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : isActiveAndPlaying ? (
          <Pause size={12} />
        ) : (
          <Play size={12} />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={isActiveAndPlaying ? "alert" : "ghost"}
      icon={
        isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : isActiveAndPlaying ? (
          <Pause size={14} />
        ) : (
          <Play size={14} />
        )
      }
      disabled={isLoading || !queueHasMp3}
      onClick={handleClick}
    >
      {isLoading ? "..." : isActiveAndPlaying ? t.pause : t.play}
    </Button>
  );
}
