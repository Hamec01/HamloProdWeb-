"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";
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
  const tagAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTagSlotRef = useRef(0);
  const queue = usePlayerStore((state) => state.queue);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const stop = usePlayerStore((state) => state.stop);
  const togglePlayback = usePlayerStore((state) => state.togglePlayback);
  const syncPlayback = usePlayerStore((state) => state.syncPlayback);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const tagAudioUrl = process.env.NEXT_PUBLIC_BEAT_TAG_URL ?? "";
  const tagIntervalSeconds = Number(process.env.NEXT_PUBLIC_BEAT_TAG_INTERVAL_SECONDS ?? "60") || 60;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      if (!currentTrack || !tagAudioUrl || tagIntervalSeconds <= 0 || audio.currentTime < tagIntervalSeconds) {
        return;
      }

      const nextSlot = Math.floor(audio.currentTime / tagIntervalSeconds);
      if (nextSlot <= lastTagSlotRef.current) {
        return;
      }

      lastTagSlotRef.current = nextSlot;
      const tagAudio = tagAudioRef.current;

      if (!tagAudio) {
        return;
      }

      tagAudio.currentTime = 0;
      void tagAudio.play().catch(() => {});
    };
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
  }, [currentTrack, next, syncPlayback, tagAudioUrl, tagIntervalSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute("src");
      lastTagSlotRef.current = 0;
      requestAnimationFrame(() => {
        setCurrentTime(0);
        setDuration(0);
      });
      return;
    }

    if (audio.src !== currentTrack.previewUrl) {
      audio.src = currentTrack.previewUrl;
      audio.load();
      lastTagSlotRef.current = 0;
      requestAnimationFrame(() => {
        setCurrentTime(0);
      });
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        syncPlayback(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying, syncPlayback]);

  const canMoveQueue = queue.length > 1;

  const seekTo = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime)) {
      return;
    }

    const clamped = Math.max(0, Math.min(nextTime, duration || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(20,15,9,0.96)] backdrop-blur">
      <audio ref={audioRef} preload="none" />
      {tagAudioUrl ? <audio ref={tagAudioRef} preload="none" src={tagAudioUrl} /> : null}
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 sm:grid-cols-[1.4fr_2fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Sticky Player</p>
          {currentTrack ? (
            <Link
              href={`/beats/${currentTrack.slug}`}
              className="block truncate font-sans text-2xl uppercase tracking-[0.05em] text-[var(--color-paper-100)] transition-colors hover:text-[var(--color-gold)]"
            >
              {currentTrack.title}
            </Link>
          ) : (
            <p className="truncate font-sans text-2xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
              Player Ready
            </p>
          )}
          <p className="truncate text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            {currentTrack ? `${currentTrack.mood} / ${currentTrack.bpm} BPM / ${currentTrack.caseNumber}` : "Open Archive and press Play"}
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="w-full accent-[var(--color-gold)]"
            aria-label="Seek playback"
            disabled={!currentTrack || duration <= 0}
          />
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">
            <span>{formatSeconds(currentTime)}</span>
            <span>{currentTrack?.duration ?? "00:00"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <Button variant="ghost" icon={<SkipBack size={14} />} onClick={previous} aria-label="Previous beat" disabled={!canMoveQueue} />
          <Button
            variant={currentTrack ? "primary" : "ghost"}
            icon={isPlaying ? <Pause size={14} /> : <Play size={14} />}
            onClick={togglePlayback}
            disabled={!currentTrack}
          >
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" icon={<Square size={14} />} onClick={stop} aria-label="Stop beat" disabled={!currentTrack}>
            Stop
          </Button>
          <Button variant="ghost" icon={<SkipForward size={14} />} onClick={next} aria-label="Next beat" disabled={!canMoveQueue} />
        </div>
      </div>
    </div>
  );
}