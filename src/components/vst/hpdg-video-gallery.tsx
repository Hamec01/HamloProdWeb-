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
  return (
    <div className={styles.gallery}>
      <div className={styles.grid}>
        {videos.map((video) => (
          <article key={video.id} className={styles.card}>
            <div className={styles.screen}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=0&controls=1&rel=0&playsinline=1`}
                title={`HPDG — ${isRu ? video.ru : video.en}`}
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className={styles.caption}>
              <span className={styles.tag}>{video.tag}</span>
              <h3>{isRu ? video.ru : video.en}</h3>
              <p>{isRu ? video.ruText : video.enText}</p>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{isRu ? "Смотреть на YouTube" : "Watch on YouTube"} ↗</a>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.footer}>
        <p>{isRu ? "Нажми Play на любом видео, чтобы начать просмотр." : "Press Play on any video to start watching."}</p>
        <a href="https://www.youtube.com/@hpdgvst" target="_blank" rel="noreferrer">{isRu ? "Все видео на канале" : "All videos on the channel"} ↗</a>
      </div>
    </div>
  );
}
