"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Beat } from "@/types";

export type PlayerQueueItem = Pick<
  Beat,
  "id" | "title" | "slug" | "previewUrl" | "bpm" | "mood" | "duration" | "caseNumber" | "status"
>;

type PlayerStore = {
  queue: PlayerQueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  setQueue: (queue: PlayerQueueItem[], startIndex?: number) => void;
  playBeat: (beat: PlayerQueueItem, queue?: PlayerQueueItem[]) => void;
  playRandom: (queue?: PlayerQueueItem[]) => void;
  togglePlayback: () => void;
  syncPlayback: (isPlaying: boolean) => void;
  next: () => void;
  previous: () => void;
};

function nextIndex(length: number, currentIndex: number) {
  return (currentIndex + 1) % length;
}

function previousIndex(length: number, currentIndex: number) {
  return (currentIndex - 1 + length) % length;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      setQueue: (queue, startIndex = 0) =>
        set({
          queue,
          currentIndex: Math.max(0, Math.min(startIndex, Math.max(queue.length - 1, 0))),
          isPlaying: queue.length > 0,
        }),
      playBeat: (beat, queue) => {
        const nextQueue = queue ?? get().queue;
        const currentQueue = nextQueue.length ? nextQueue : [beat];
        const index = currentQueue.findIndex((item) => item.id === beat.id);

        set({
          queue: currentQueue,
          currentIndex: index >= 0 ? index : 0,
          isPlaying: true,
        });
      },
      playRandom: (queue) => {
        const currentQueue = queue ?? get().queue;
        if (!currentQueue.length) {
          return;
        }

        const randomIndex = Math.floor(Math.random() * currentQueue.length);
        set({ queue: currentQueue, currentIndex: randomIndex, isPlaying: true });
      },
      togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
      syncPlayback: (isPlaying) => set({ isPlaying }),
      next: () => {
        const { queue, currentIndex } = get();
        if (!queue.length) {
          return;
        }

        set({ currentIndex: nextIndex(queue.length, currentIndex), isPlaying: true });
      },
      previous: () => {
        const { queue, currentIndex } = get();
        if (!queue.length) {
          return;
        }

        set({ currentIndex: previousIndex(queue.length, currentIndex), isPlaying: true });
      },
    }),
    {
      name: "hamloprod-player",
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
      }),
    },
  ),
);