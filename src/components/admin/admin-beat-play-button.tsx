"use client";

import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";
import type { PlayerTrack } from "@/store/player-store";
import type { Beat } from "@/types";

function toPlayerBeat(beat: Beat): PlayerTrack {
  return {
    ...beat,
    previewUrl: beat.previewUrl ?? "",
    kind: "beat",
  };
}

export function AdminBeatPlayButton({ beat }: { beat: Beat }) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playBeat = usePlayerStore((state) => state.playBeat);
  const pause = usePlayerStore((state) => state.pause);

  const isCurrentBeat = currentTrack?.id === beat.id;
  const label = isCurrentBeat && isPlaying ? "Pause" : "Play";

  return (
    <Button
      variant={isCurrentBeat && isPlaying ? "alert" : "ghost"}
      onClick={() => {
        if (isCurrentBeat && isPlaying) {
          pause();
          return;
        }

        const playerBeat = toPlayerBeat(beat);
        playBeat(playerBeat, [playerBeat]);
      }}
    >
      {label}
    </Button>
  );
}