"use client";

import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";
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

export function RandomBeatButton({ beats, locale }: { beats: Beat[]; locale: Locale }) {
  const playRandom = usePlayerStore((state) => state.playRandom);
  const t = dictionary[locale];

  return (
    <Button variant="ghost" icon={<Shuffle size={14} />} onClick={() => playRandom(beats.map(toPlayerBeat))}>
      {t.playRandom}
    </Button>
  );
}