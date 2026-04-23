"use client";

import { useEffect } from "react";
import { usePlayerStore, type PlayerQueueItem } from "@/store/player-store";

/** Loads artist tracks into the player queue without auto-playing */
export function ArtistPlayerLoader({ tracks }: { tracks: PlayerQueueItem[] }) {
  const loadQueue = usePlayerStore((s) => s.loadQueue);

  useEffect(() => {
    if (tracks.length === 0) return;
    loadQueue(tracks, "artist");
  }, [tracks, loadQueue]);

  return null;
}
