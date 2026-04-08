"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Beat } from "@/types";

export type PlayerTrack = Pick<
  Beat,
  "id" | "title" | "slug" | "previewUrl" | "bpm" | "mood" | "duration" | "caseNumber" | "status"
>;

export type PlayerQueueItem = PlayerTrack;

type PlayerStore = {
  queue: PlayerQueueItem[];
  currentIndex: number;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  setQueue: (queue: PlayerQueueItem[], startIndex?: number) => void;
  play: (track: PlayerTrack, queue?: PlayerQueueItem[]) => void;
  pause: () => void;
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
      currentTrack: null,
      isPlaying: false,
      setQueue: (queue, startIndex = 0) =>
        set(() => {
          const nextIndexValue = Math.max(0, Math.min(startIndex, Math.max(queue.length - 1, 0)));

          return {
            queue,
            currentIndex: nextIndexValue,
            currentTrack: queue[nextIndexValue] ?? null,
            isPlaying: queue.length > 0,
          };
        }),
      play: (track, queue) => {
        const nextQueue = queue ?? get().queue;
        const currentQueue = nextQueue.length ? nextQueue : [track];
        const index = currentQueue.findIndex((item) => item.id === track.id);

        set({
          queue: currentQueue,
          currentIndex: index >= 0 ? index : 0,
          currentTrack: index >= 0 ? currentQueue[index] : currentQueue[0] ?? null,
          isPlaying: true,
        });
      },
      pause: () => set({ isPlaying: false }),
      playBeat: (beat, queue) => {
        get().play(beat, queue);
      },
      playRandom: (queue) => {
        const currentQueue = queue ?? get().queue;
        if (!currentQueue.length) {
          return;
        }

        const randomIndex = Math.floor(Math.random() * currentQueue.length);
        set({
          queue: currentQueue,
          currentIndex: randomIndex,
          currentTrack: currentQueue[randomIndex] ?? null,
          isPlaying: true,
        });
      },
      togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
      syncPlayback: (isPlaying) => set({ isPlaying }),
      next: () => {
        const { queue, currentIndex } = get();
        if (!queue.length) {
          return;
        }

        const nextQueueIndex = nextIndex(queue.length, currentIndex);
        set({
          currentIndex: nextQueueIndex,
          currentTrack: queue[nextQueueIndex] ?? null,
          isPlaying: true,
        });
      },
      previous: () => {
        const { queue, currentIndex } = get();
        if (!queue.length) {
          return;
        }

        const previousQueueIndex = previousIndex(queue.length, currentIndex);
        set({
          currentIndex: previousQueueIndex,
          currentTrack: queue[previousQueueIndex] ?? null,
          isPlaying: true,
        });
      },
    }),
    {
      name: "hamloprod-player",
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
      }),
    },
  ),
);