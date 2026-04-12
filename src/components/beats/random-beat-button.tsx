"use client";

import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";
import { usePlayerStore } from "@/store/player-store";
import type { Beat } from "@/types";

export function RandomBeatButton({ beats, locale }: { beats: Beat[]; locale: Locale }) {
  const playRandom = usePlayerStore((state) => state.playRandom);
  const t = dictionary[locale];

  return (
    <Button variant="ghost" icon={<Shuffle size={14} />} onClick={() => playRandom(beats)}>
      {t.playRandom}
    </Button>
  );
}