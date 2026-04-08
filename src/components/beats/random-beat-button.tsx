"use client";

import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";
import type { Beat } from "@/types";

export function RandomBeatButton({ beats }: { beats: Beat[] }) {
  const playRandom = usePlayerStore((state) => state.playRandom);

  return (
    <Button variant="ghost" icon={<Shuffle size={14} />} onClick={() => playRandom(beats)}>
      Play Random Beat
    </Button>
  );
}