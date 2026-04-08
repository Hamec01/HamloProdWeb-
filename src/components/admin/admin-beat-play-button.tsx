"use client";

import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";
import type { Beat } from "@/types";

export function AdminBeatPlayButton({ beat }: { beat: Beat }) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const play = usePlayerStore((state) => state.play);
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

        play(beat, [beat]);
      }}
    >
      {label}
    </Button>
  );
}