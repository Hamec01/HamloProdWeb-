"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";
import { usePlayerStore } from "@/store/player-store";
import type { Beat } from "@/types";

export function PlayBeatButton({ beat, queue, locale }: { beat: Beat; queue: Beat[]; locale: Locale }) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const play = usePlayerStore((state) => state.play);
  const pause = usePlayerStore((state) => state.pause);
  const t = dictionary[locale];
  const isCurrentBeat = currentTrack?.id === beat.id;
  const isCurrentBeatPlaying = isCurrentBeat && isPlaying;

  return (
    <Button
      variant={isCurrentBeatPlaying ? "alert" : "primary"}
      icon={isCurrentBeatPlaying ? <Pause size={14} /> : <Play size={14} />}
      onClick={() => {
        if (isCurrentBeatPlaying) {
          pause();
          return;
        }

        play(beat, queue);
      }}
    >
      {isCurrentBeatPlaying ? t.pause : t.play}
    </Button>
  );
}