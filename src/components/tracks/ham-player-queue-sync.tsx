"use client";

import { useEffect } from "react";
import { usePlayerStore, type PlayerTrack } from "@/store/player-store";

type HamPlayerQueueSyncProps = {
  queue: PlayerTrack[];
};

export function HamPlayerQueueSync({ queue }: HamPlayerQueueSyncProps) {
  const primeQueue = usePlayerStore((state) => state.primeQueue);

  useEffect(() => {
    primeQueue(queue, "ham");
  }, [primeQueue, queue]);

  return null;
}