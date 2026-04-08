"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";
import type { Beat } from "@/types";

export function PlayBeatButton({ beat, queue }: { beat: Beat; queue: Beat[] }) {
  const playBeat = usePlayerStore((state) => state.playBeat);

  return (
    <Button icon={<Play size={14} />} onClick={() => playBeat(beat, queue)}>
      Play
    </Button>
  );
}