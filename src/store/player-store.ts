"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayerTrack = {
  id: string;
  title: string;
  slug: string;
  previewUrl: string;
  kind?: "beat" | "track";
  artistName?: string;
  // Beat-specific (optional for track items)
  bpm?: number;
  mood?: string;
  duration?: string;
  caseNumber?: string;
  status?: "available" | "reserved" | "sold" | "private";
};

export type PlayerQueueItem = PlayerTrack;

export type RepeatMode = "none" | "one" | "all";

type PlayerStore = {
  queue: PlayerQueueItem[];
  currentIndex: number;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  setQueue: (queue: PlayerQueueItem[], startIndex?: number) => void;
  play: (track: PlayerTrack, queue?: PlayerQueueItem[]) => void;
  pause: () => void;
  stop: () => void;
  playBeat: (beat: PlayerQueueItem, queue?: PlayerQueueItem[]) => void;
  playRandom: (queue?: PlayerQueueItem[]) => void;
  togglePlayback: () => void;
  syncPlayback: (isPlaying: boolean) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
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
      repeatMode: "none",
      shuffle: false,
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
      stop: () => set({ currentTrack: null, isPlaying: false }),
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
      togglePlayback: () =>
        set((state) => {
          if (!state.currentTrack) {
            return state;
          }

          return { isPlaying: !state.isPlaying };
        }),
      syncPlayback: (isPlaying) => set({ isPlaying }),
      cycleRepeat: () =>
        set((state) => {
          const next: RepeatMode = state.repeatMode === "none" ? "all" : state.repeatMode === "all" ? "one" : "none";
          return { repeatMode: next };
        }),
      toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
      next: () => {
        const { queue, currentIndex, repeatMode, shuffle } = get();
        if (!queue.length) return;

        if (repeatMode === "one") {
          // Sticky player handles audio replay in handleEnded; just ensure isPlaying stays true
          set({ isPlaying: true });
          return;
        }

        if (shuffle) {
          let randomIdx = Math.floor(Math.random() * queue.length);
          if (queue.length > 1 && randomIdx === currentIndex) randomIdx = (randomIdx + 1) % queue.length;
          set({ currentIndex: randomIdx, currentTrack: queue[randomIdx] ?? null, isPlaying: true });
          return;
        }

        const isLast = currentIndex >= queue.length - 1;
        if (repeatMode === "none" && isLast) {
          set({ isPlaying: false });
          return;
        }

        const nextIdx = nextIndex(queue.length, currentIndex);
        set({ currentIndex: nextIdx, currentTrack: queue[nextIdx] ?? null, isPlaying: true });
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
        repeatMode: state.repeatMode,
        shuffle: state.shuffle,
        // isPlaying is intentionally NOT persisted — no auto-start on page load
      }),
    },
  ),
);