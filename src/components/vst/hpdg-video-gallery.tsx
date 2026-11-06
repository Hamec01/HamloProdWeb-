"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./hpdg-video-gallery.module.css";

const videos = [
  { id: "SK3EnGJ92HQ", tag: "OVERVIEW · BETA 6", ru: "Пять жанров. Один генератор.", en: "Five genres. One generator.", ruText: "Обзор HPDG: барабаны, бас, анализ семпла и перенос в DAW.", enText: "A tour of HPDG: drums, bass, sample analysis and moving into your DAW." },
  { id: "qF5HT82e0T0", tag: "DARK TRAP", ru: "Dark Trap за минуту", en: "Dark Trap in one minute", ruText: "Послушай, как HPDG собирает тёмный Trap-грув.", enText: "Hear HPDG build a dark Trap groove." },
  { id: "EncE73aViI4", tag: "BOOM BAP", ru: "Boom Bap за минуту", en: "Boom Bap in one minute", ruText: "От идеи до барабанной партии в HPDG.", enText: "From an idea to a drum pattern in HPDG." },
  { id: "TvjsnCh6J8w", tag: "ATLANTA", ru: "Atlanta Type Beat", en: "Atlanta Type Beat", ruText: "Кик, хэты и 808 в характере Atlanta.", enText: "Kicks, hats and 808 with an Atlanta character." },
  { id: "dfGLEPtaYG8", tag: "SAMPLE → TRAP", ru: "Твой семпл. Новый Trap-бит.", en: "Your sample. A new Trap beat.", ruText: "Как нарезанный семпл становится основой для генерации.", enText: "How a chopped sample becomes the starting point for generation." },
  { id: "d17_KGVUdBw", tag: "TECHNO", ru: "Techno в один клик", en: "Techno in one click", ruText: "Генерация Techno-барабанов внутри FL Studio.", enText: "Generating Techno drums inside FL Studio." },
] as const;

export function HpdgVideoGallery({ isRu }: { isRu: boolean }) {
  const [selectedId, setSelectedId] = useState<string>(videos[0].id);
  const [playerOpen, setPlayerOpen] = useState(false);
  const selected = videos.find((v) => v.id === selectedId)!;
  const title = isRu ? selected.ru : selected.en;

  return (
    <div className={styles.gallery}>
      <div className={styles.featured}>
        <div className={styles.screen}>
          {playerOpen ? (
            <iframe
              key={selected.id}
              src={`https://www.youtube-nocookie.com/embed/${selected.id}?autoplay=0&rel=0&playsinline=1`}
              title={`HPDG — ${title}`}
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button type="button" className={styles.poster} onClick={() => setPlayerOpen(true)} aria-label={`${isRu ? "Открыть плеер" : "Open player"}: ${title}`}>
              <Image src={`/hpdg/youtube/${selected.id}.jpg`} alt="" fill sizes="(max-width: 800px) 100vw, 75vw" />
              <span className={styles.play} aria-hidden="true">▶</span>
              <span className={styles.posterLabel}>{isRu ? "Открыть плеер" : "Open player"}</span>
            </button>
          )}
        </div>
        <div className={styles.featuredCaption} aria-live="polite">
          <div>
            <span className={styles.tag}>{selected.tag}</span>
            <h3>{title}</h3>
            <p>{isRu ? selected.ruText : selected.enText}</p>
          </div>
          <a href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noreferrer">{isRu ? "На YouTube" : "On YouTube"} ↗</a>
        </div>
      </div>
      <div className={styles.grid} aria-label={isRu ? "Выбрать видео HPDG" : "Choose an HPDG video"}>
        {videos.map((video, index) => (
          <button
            type="button"
            key={video.id}
            className={styles.card}
            aria-pressed={selectedId === video.id}
            onClick={() => { setSelectedId(video.id); setPlayerOpen(false); }}
          >
            <span className={styles.thumbnail}>
              <Image src={`/hpdg/youtube/${video.id}.jpg`} alt="" fill sizes="(max-width: 600px) 50vw, 33vw" />
              <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.miniPlay} aria-hidden="true">▶</span>
            </span>
            <span className={styles.cardCopy}><span className={styles.tag}>{video.tag}</span><strong>{isRu ? video.ru : video.en}</strong></span>
          </button>
        ))}
      </div>
      <div className={styles.footer}>
        <p>{isRu ? "Выбери ролик и открой плеер. Воспроизведение — только по нажатию Play." : "Choose a video and open the player. Playback starts only when you press Play."}</p>
        <a href="https://www.youtube.com/@hpdgvst" target="_blank" rel="noreferrer">{isRu ? "Все видео на канале" : "All videos on the channel"} ↗</a>
      </div>
    </div>
  );
}
