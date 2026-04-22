"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTrackStreamUrl } from "@/lib/audio/fetch-track-stream-url";
import { dictionary, type Locale } from "@/lib/i18n";
import { usePlayerStore } from "@/store/player-store";

function formatSeconds(seconds: number) {
  const safe = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

type PathSection = "landing" | "beats" | "ham" | "vst" | "other";

function resolvePathSection(pathname: string): PathSection {
  const segments = pathname.split("/").filter(Boolean);

  if (!segments.length) {
    return "landing";
  }

  const first = segments[0] ?? "";
  const hasLocalePrefix = first === "ru" || first === "en";
  const section = hasLocalePrefix ? segments[1] : first;

  if (!section) {
    return "landing";
  }

  if (section === "beats") {
    return "beats";
  }

  if (section === "ham" || section === "tracks") {
    return "ham";
  }

  if (section === "vst") {
    return "vst";
  }

  return "other";
}

export function StickyPlayer({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const pathSection = resolvePathSection(pathname);
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
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const setShuffle = usePlayerStore((state) => state.setShuffle);
  const playRandom = usePlayerStore((state) => state.playRandom);
  const reset = usePlayerStore((state) => state.reset);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isResolvingQueue, setIsResolvingQueue] = useState(false);
  const tagAudioUrl = process.env.NEXT_PUBLIC_BEAT_TAG_URL ?? "";
  const tagIntervalSeconds = Number(process.env.NEXT_PUBLIC_BEAT_TAG_INTERVAL_SECONDS ?? "60") || 60;
  const t = dictionary[locale];

  useEffect(() => {
    if (pathSection === "ham") {
      if (currentTrack && currentTrack.kind !== "track") {
        reset();
        return;
      }

      if (queue.some((item) => item.kind !== "track")) {
        reset();
      }

      return;
    }

    if (pathSection === "beats") {
      if (currentTrack?.kind === "track") {
        reset();
        return;
      }

      if (queue.some((item) => item.kind === "track")) {
        reset();
      }

      return;
    }

    if ((pathSection === "vst" || pathSection === "other" || pathSection === "landing") && (currentTrack || queue.length > 0)) {
      reset();
    }
  }, [pathSection, currentTrack, queue, reset]);

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
    const handleEnded = () => {
      const { repeatMode: mode } = usePlayerStore.getState();
      if (mode === "one") {
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } else {
        next();
      }
    };
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

  const handlePrimaryAction = async () => {
    if (currentTrack) {
      togglePlayback();
      return;
    }

    if (pathSection !== "ham" || queue.length === 0) {
      return;
    }

    setIsResolvingQueue(true);
    try {
      const resolvedQueue = await Promise.all(
        queue.map(async (track) => {
          const previewUrl = track.previewUrl || (track.kind === "track" ? await fetchTrackStreamUrl(track.id) : track.previewUrl);
          return {
            ...track,
            previewUrl,
          };
        }),
      );

      const playableTracks = resolvedQueue.filter((track) => Boolean(track.previewUrl));
      if (!playableTracks.length) {
        return;
      }

      setShuffle(true);
      playRandom(playableTracks);
    } finally {
      setIsResolvingQueue(false);
    }
  };

  if (pathSection !== "beats" && pathSection !== "ham") {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[rgba(12,11,9,0.96)] pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur">
      <audio ref={audioRef} preload="none" />
      {tagAudioUrl ? <audio ref={tagAudioRef} preload="none" src={tagAudioUrl} /> : null}
      <div className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-4 md:grid-cols-[1.4fr_2fr_auto] md:items-center md:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.stickyPlayer}</p>
          {currentTrack ? (
            currentTrack.kind === "track" ? (
              <p className="truncate font-sans text-xl uppercase tracking-[0.05em] text-[var(--color-paper-100)] sm:text-2xl">
                {currentTrack.title}
              </p>
            ) : (
              <Link
                href={`/beats/${currentTrack.slug}`}
                className="block truncate font-sans text-xl uppercase tracking-[0.05em] text-[var(--color-paper-100)] transition-colors hover:text-[var(--color-gold)] sm:text-2xl"
              >
                {currentTrack.title}
              </Link>
            )
          ) : (
            <p className="truncate font-sans text-xl uppercase tracking-[0.05em] text-[var(--color-paper-100)] sm:text-2xl">
              {t.playerReady}
            </p>
          )}
          <p className="truncate text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            {currentTrack
              ? currentTrack.kind === "track"
                ? currentTrack.artistName ?? "HaM"
                : `${currentTrack.mood} / ${currentTrack.bpm} BPM / ${currentTrack.caseNumber}`
              : "Open Archive and press Play"}
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

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-self-end">
          {/* Shuffle */}
          <button
            type="button"
            onClick={() => { toggleShuffle(); if (!shuffle && queue.length > 1) playRandom(); }}
            disabled={queue.length <= 1}
            aria-label="Shuffle"
            title={shuffle ? "Перемешать: вкл" : "Перемешать: выкл"}
            className={`flex h-9 w-9 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${shuffle ? "border-amber-500 text-amber-500" : "border-[var(--color-line)] text-[var(--color-paper-400)] hover:border-[var(--color-paper-200)] hover:text-[var(--color-paper-100)]"}`}
          >
            <Shuffle size={12} />
          </button>

          <Button variant="ghost" icon={<SkipBack size={14} />} onClick={previous} aria-label="Previous beat" disabled={!canMoveQueue} />
          <Button
            variant={currentTrack ? "primary" : "ghost"}
            icon={isResolvingQueue ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : isPlaying ? <Pause size={14} /> : <Play size={14} />}
            onClick={handlePrimaryAction}
            disabled={isResolvingQueue || (!currentTrack && !(pathSection === "ham" && queue.length > 0))}
          >
            {isResolvingQueue ? "..." : isPlaying ? t.pause : t.play}
          </Button>
          <Button variant="ghost" icon={<Square size={14} />} onClick={stop} aria-label="Stop beat" disabled={!currentTrack}>
            {t.stop}
          </Button>
          <Button variant="ghost" icon={<SkipForward size={14} />} onClick={next} aria-label="Next beat" disabled={!canMoveQueue} />

          {/* Repeat */}
          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={`Повтор: ${repeatMode}`}
            title={repeatMode === "none" ? "Повтор: выкл" : repeatMode === "all" ? "Повтор: все" : "Повтор: один трек"}
            className={`flex h-9 w-9 items-center justify-center border transition-colors ${repeatMode !== "none" ? "border-amber-500 text-amber-500" : "border-[var(--color-line)] text-[var(--color-paper-400)] hover:border-[var(--color-paper-200)] hover:text-[var(--color-paper-100)]"}`}
          >
            {repeatMode === "one" ? <Repeat1 size={12} /> : <Repeat size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}