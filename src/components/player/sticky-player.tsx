"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";

function formatSeconds(seconds: number) {
  const safe = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function StickyPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const togglePlayback = usePlayerStore((state) => state.togglePlayback);
  const syncPlayback = usePlayerStore((state) => state.syncPlayback);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const currentTrack = queue[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => next();
    const handlePause = () => syncPlayback(false);
    const handlePlay = () => syncPlayback(true);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [next, syncPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute("src");
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== currentTrack.previewUrl) {
      audio.src = currentTrack.previewUrl;
      audio.load();
      setCurrentTime(0);
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        syncPlayback(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, syncPlayback]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(15,13,11,0.92)] backdrop-blur">
      <audio ref={audioRef} preload="none" />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 sm:grid-cols-[1.4fr_2fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Sticky Player</p>
          <p className="truncate font-sans text-2xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
            {currentTrack ? currentTrack.title : "Player Ready"}
          </p>
          <p className="truncate text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            {currentTrack ? `${currentTrack.mood} / ${currentTrack.bpm} BPM / ${currentTrack.caseNumber}` : "Open Archive and press Play"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.04)]">
            <div
              className="h-full bg-[linear-gradient(90deg,var(--color-paper-100),var(--color-gold))] transition-[width]"
              style={{
                width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">
            <span>{formatSeconds(currentTime)}</span>
            <span>{currentTrack?.duration ?? "00:00"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <Button variant="ghost" icon={<SkipBack size={14} />} onClick={previous} aria-label="Previous beat" />
          <Button
            variant={currentTrack ? "primary" : "ghost"}
            icon={isPlaying ? <Pause size={14} /> : <Play size={14} />}
            onClick={togglePlayback}
            disabled={!currentTrack}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" icon={<SkipForward size={14} />} onClick={next} aria-label="Next beat" />
        </div>
      </div>
    </div>
  );
}