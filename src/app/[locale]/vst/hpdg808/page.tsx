import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Hpdg808Download } from "@/components/vst/hpdg808-download";
import { hpdg808Release } from "@/lib/hpdg808/release";
import { normalizeLocale } from "@/lib/market";
import styles from "./page.module.css";

type PageProps = { params: Promise<{ locale: string }> };
const guideHref = "/hpdg808/GUIDE_EN.html";

function getTipHref() {
  const value = (process.env.HPDG808_TIP_URL ?? "https://buy.stripe.com/5kQfZj0kgaKFavQ4E6cjS02").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["buy.stripe.com", "donate.stripe.com"].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = normalizeLocale((await params).locale);
  const isRu = locale === "ru";
  const title = isRu
    ? "HPDG 808 — бесплатный басовый инструмент | HamloProd"
    : "HPDG 808 — Free Bass Instrument | HamloProd";
  const description = isRu
    ? "Бесплатный 808-синтезатор: 200 пресетов, семплер, HamloMag и мастер-секция для баса. Windows 10/11 x64, VST3 и Standalone. Без активации, с добровольными чаевыми."
    : "A free 808 bass instrument with 200 presets, a sample layer, HamloMag saturation and bass mastering. Windows 10/11 x64, VST3 and Standalone. No activation. Optional tips.";
  return {
    title,
    description,
    alternates: {
      canonical: `https://hamloprod.org/${locale}/vst/hpdg808`,
      languages: {
        en: "https://hamloprod.org/en/vst/hpdg808",
        ru: "https://hamloprod.org/ru/vst/hpdg808",
      },
    },
    openGraph: {
      type: "website",
      siteName: "HamloProd",
      title,
      description,
      url: `https://hamloprod.org/${locale}/vst/hpdg808`,
      images: [{ url: "https://hamloprod.org/hpdg808/images/hpdg808_synth.png", width: 1000, height: 650, alt: "HPDG 808 — SYNTH" }],
    },
  };
}

export default async function Hpdg808Page({ params }: PageProps) {
  const locale = normalizeLocale((await params).locale);
  const isRu = locale === "ru";
  const tipHref = getTipHref();
  const features = isRu ? [
    ["PRESETS", "200 звуков по стилям", "Boom Bap, Trap, Rap, Drill, DnB, Techno и Atmospheric. От Dusty и Jazzy до Dark Trap, Rage, Memphis, Neurofunk и Liquid — пресеты сгруппированы по жанрам и подстилям и выровнены по громкости."],
    ["SOUND", "Характер настоящих 808", "Пресеты настроены по более чем тысяче профессиональных басовых ваншотов: с учётом их атаки, тембра и затухания."],
    ["SYNTH", "Бас, который движется", "Пять форм волны, саб-осциллятор, Punch до 48 полутонов, Drive и Saturation. Tone следует за нотой, Tone Fall управляет затуханием гармоник, а Swell — нарастанием после удара."],
    ["MASTER", "Готов к миксу", "Срез или усиление саба, монофонический низ и ширина выше него. Стереогармоники для небольших динамиков, компрессор / экспандер и лимитер завершают звук внутри плагина."],
    ["SAMPLE", "Твой 808 или кик", "Загрузи WAV, AIFF, FLAC, MP3 или OGG. Зацикли семпл, играй им по клавишам или плавно передай звучание от кика к синтезатору."],
    ["EXPORT", "Перетащи бас в DAW", "Сыграй ноту и перетащи готовый ваншот на дорожку или нажми Export WAV. Стерео WAV, 48 кГц, с обработкой мастер-секции."],
    ["SATURATOR", "Шесть характеров перегруза", "HamloMag: Classic, Tape, Tube, Iron, Germanium и Vinyl. Управляй насыщением, гармониками и долей обработанного сигнала."],
    ["PLAY", "Слайды и глайды", "Режимы Retrigger, Legato и Glide для 808-слайдов. Фильтр с собственной огибающей и LFO с синхронизацией по темпу."],
    ["HPDG", "Из семейства HPDG", "Басовый движок HPDG стал отдельным инструментом. Свои сохранённые пресеты можно использовать и здесь, и в дорожке Sub808 совместимой версии HPDG."],
  ] : [
    ["PRESETS", "200 sounds by style", "Boom Bap, Trap, Rap, Drill, DnB, Techno and Atmospheric. From Dusty and Jazzy to Dark Trap, Rage, Memphis, Neurofunk and Liquid: sounds grouped by genre and substyle, levelled and ready to play."],
    ["SOUND", "Matched to real 808s", "The presets were fitted to over a thousand professional bass one-shots, matching their punch, tone and decay."],
    ["SYNTH", "An 808 that moves", "Five wave shapes, a sub oscillator, Punch up to 48 semitones, Drive and Saturation. Tone follows the note, Tone Fall shapes the fading harmonics, and Swell adds bloom after the hit."],
    ["MASTER", "Finished for the mix", "Sub cut or boost, a mono low end with width above it, stereo harmonics for small speakers, a compressor / expander and a limiter. Finish the bass inside the plugin."],
    ["SAMPLE", "Your own 808 or kick", "Load WAV, AIFF, FLAC, MP3 or OGG. Loop it, play it across the keys, or let a kick hand over to the synth."],
    ["EXPORT", "Drag the bass out", "Play a note, then drag the finished one-shot onto a track or press Export WAV. A 48 kHz stereo WAV with the master processing included."],
    ["SATURATOR", "Six flavours of drive", "HamloMag: Classic, Tape, Tube, Iron, Germanium and Vinyl, with drive, harmonics and mix controls."],
    ["PLAY", "Slides and glides", "Retrigger, Legato and Glide modes for 808 slides, a filter with its own envelope and a tempo-synced LFO."],
    ["HPDG", "From the HPDG family", "The bass engine of HPDG as its own instrument. Share your saved presets with the Sub808 lane in a compatible version of HPDG."],
  ];
  const gallery = [
    { id: "master", title: "MASTER", ru: "Саб, ширина, стереогармоники и динамика", en: "Sub, width, stereo harmonics and dynamics" },
    { id: "fx", title: "FILTER / FX", ru: "Фильтр, LFO и сатуратор HamloMag", en: "Filter, LFO and the HamloMag saturator" },
    { id: "sample", title: "SAMPLE", ru: "Твой 808 или кик: зацикливание и растяжение", en: "Your own 808 or kick, with loop and stretch" },
    { id: "mix", title: "MIX", ru: "Баланс синтезатора и семпла, переход от кика к 808", en: "Synth and sample levels, kick-to-808 handoff" },
  ];

  return (
    <div className={styles.page}>
      <nav className={styles.nav} aria-label={isRu ? "Навигация по плагину" : "Plugin navigation"}>
        <Link className={styles.back} href={`/${locale}/vst`}>← VST</Link>
        <div>
          <a href="#features">{isRu ? "Возможности" : "Features"}</a>
          <a href="#screens">{isRu ? "Интерфейс" : "Interface"}</a>
          <a href="#download">{isRu ? "Скачать" : "Download"}</a>
        </div>
      </nav>

      <section className={styles.hero} aria-labelledby="hpdg808-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>HAMLOPROD / BASS INSTRUMENT</p>
          <h1 id="hpdg808-title">HPDG <span>808</span></h1>
          <p className={styles.subtitle}>{isRu ? "Твой бас. Твой характер." : "Your bass. Your character."}</p>
          <p className={styles.lead}>{isRu
            ? "808 и басы, готовые к миксу. Синтезатор, семплер и мастер-секция в одном бесплатном инструменте."
            : "808s and basses ready for a mix. A synth, a sample layer and bass mastering in one free instrument."}</p>
          <ul className={styles.bullets}>
            <li>{isRu ? "200 пресетов в 7 жанрах" : "200 presets across 7 genres"}</li>
            <li>{isRu ? "VST3 и Standalone для Windows" : "VST3 and Standalone for Windows"}</li>
            <li>{isRu ? "Готовый WAV — прямо в DAW" : "Drag the finished WAV straight into your DAW"}</li>
          </ul>
          <div className={styles.actions}>
            <Hpdg808Download className={styles.primaryButton} locale={locale} label={isRu ? "Скачать бесплатно" : "Download free"} />
            <a className={styles.secondaryButton} href="#support">{isRu ? "На чай? =)" : "Leave a tip? =)"}</a>
          </div>
          <p className={styles.fine}>v{hpdg808Release.version} · WINDOWS 10/11 x64 · {isRu ? "БЕЗ АКТИВАЦИИ" : "NO ACTIVATION"}</p>
        </div>
        <figure className={styles.heroShot}>
          <div className={styles.frameLabel}><span>HPDG 808 / SYNTH</span><span className={styles.freeBadge}>{isRu ? "БЕСПЛАТНО" : "FREE"}</span></div>
          <a href="/hpdg808/images/hpdg808_synth.png" target="_blank" rel="noreferrer" aria-label={isRu ? "Открыть SYNTH в полном размере (новая вкладка)" : "Open SYNTH at full size (new tab)"}>
            <Image src="/hpdg808/images/hpdg808_synth.png" width={1000} height={650} sizes="(max-width: 900px) 100vw, 58vw" alt={isRu ? "HPDG 808: осциллятор, волна, Punch, 808 Tone и огибающая в разделе SYNTH" : "HPDG 808 SYNTH: oscillator, waveform, Punch, 808 Tone and envelope"} priority />
          </a>
          <figcaption>{isRu ? "Настоящий интерфейс плагина · SYNTH" : "Actual plugin interface · SYNTH"}</figcaption>
        </figure>
      </section>

      <section className={styles.stats} aria-label={isRu ? "Ключевые факты" : "Key facts"}>
        {[["200", isRu ? "пресетов" : "presets"], ["7", isRu ? "жанров" : "genres"], ["5", isRu ? "секций" : "sections"], [isRu ? "Бесплатно" : "Free", isRu ? "чаевые по желанию" : "optional tips"]].map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <aside className={styles.releaseNote}>
        <p className={styles.eyebrow}>{hpdg808Release.version} / {isRu ? "ИСПРАВЛЕНИЕ" : "BUG FIX"}</p>
        <p>{isRu
          ? "Исправлена вкладка MIX: секции LAYERS, WEIGHT и ENVELOPE размещены в два ряда, а регуляторы Sustain и Release больше не обрезаются. Если у тебя версия 1.0.0 — скачай обновлённый установщик."
          : "Fixed the MIX tab: LAYERS, WEIGHT and ENVELOPE now sit in two rows, so the Sustain and Release knobs are no longer cut off. If you have version 1.0.0, download the updated installer."}</p>
      </aside>

      <section className={styles.section} id="features">
        <header className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{isRu ? "ОТДЕЛЬНЫЙ ИНСТРУМЕНТ" : "A STANDALONE INSTRUMENT"} / {hpdg808Release.version}</p>
          <h2>{isRu ? "Тот самый 808 из HPDG. Теперь отдельно." : "The 808 from HPDG. Now on its own."}</h2>
          <p>{isRu ? "Играй с MIDI-клавиатуры или из piano roll, меняй характер звука и забирай готовый бас в свой проект." : "Play from a MIDI keyboard or piano roll, shape the sound, and bring the finished bass into your project."}</p>
        </header>
        <div className={styles.cards}>
          {features.map(([label, title, text], index) => (
            <article className={styles.card} key={label}>
              <p className={styles.eyebrow}>{String(index + 1).padStart(2, "0")} / {label}</p>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
        <div className={styles.genres} aria-label={isRu ? "Фабричные пресеты" : "Factory presets"}>
          {[["Boom Bap", 48], ["Trap", 48], ["Rap", 21], ["Drill", 12], ["DnB", 24], ["Techno", 28], ["Atmospheric", 15], ["Utility", 4]].map(([genre, count]) => <span key={genre}>{genre}<b>{count}</b></span>)}
        </div>
      </section>

      <section className={styles.section} id="screens">
        <header className={styles.sectionHeader}>
          <p className={styles.eyebrow}>{isRu ? "ВНУТРИ ПЛАГИНА" : "INSIDE THE PLUGIN"}</p>
          <h2>{isRu ? "Каждая часть баса" : "Every part of the bass"}</h2>
          <p>{isRu ? "От первого удара до финальной обработки. Нажми на скриншот, чтобы рассмотреть все детали." : "From the first hit to the final processing. Open any screenshot to see the details."}</p>
        </header>
        <div className={styles.gallery}>
          {gallery.map((shot) => (
            <figure key={shot.id}>
              <a href={`/hpdg808/images/hpdg808_${shot.id}.png`} target="_blank" rel="noreferrer" aria-label={isRu ? `Открыть ${shot.title} в полном размере (новая вкладка)` : `Open ${shot.title} at full size (new tab)`}>
                <Image src={`/hpdg808/images/hpdg808_${shot.id}.png`} width={1000} height={650} sizes="(max-width: 700px) 100vw, 50vw" alt={`HPDG 808 — ${shot.title}: ${isRu ? shot.ru : shot.en}`} />
              </a>
              <figcaption><strong>{shot.title}</strong><span>{isRu ? shot.ru : shot.en}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.downloadSection} id="download">
        <div className={styles.downloadCard}>
          <p className={styles.eyebrow}>HPDG 808 / {hpdg808Release.version}</p>
          <h2>{isRu ? "Бас — бесплатно." : "The bass is free."}</h2>
          <p>{isRu ? "Полная версия, все 200 пресетов, VST3 и Standalone в одном установщике. Без регистрации и ключа активации." : "The full version, all 200 presets, VST3 and Standalone in one installer. No account or activation key needed."}</p>
          <Hpdg808Download className={styles.primaryButton} locale={locale} label={isRu ? "Скачать для Windows" : "Download for Windows"} />
          <p className={styles.fine}>WINDOWS 10/11 · 64-BIT · EXE · {(hpdg808Release.size / 1024 / 1024).toFixed(1)} MiB</p>
          <div className={styles.fileLinks}>
            <a href={guideHref} target="_blank" rel="noreferrer">{isRu ? "Руководство (EN)" : "User guide (EN)"} ↗</a>
            <a href="/hpdg808/RELEASE.txt" target="_blank" rel="noreferrer">{isRu ? "О релизе (EN)" : "Release notes"} ↗</a>
            <a href={`/hpdg808/${hpdg808Release.fileName}.sha256`} download>SHA-256 ↓</a>
          </div>
        </div>
        <aside className={styles.tipCard} id="support" aria-labelledby="tip-title">
          <span className={styles.tea} aria-hidden="true">☕</span>
          <p className={styles.eyebrow}>{isRu ? "ЧАЕВЫЕ ПО ЖЕЛАНИЮ" : "OPTIONAL TIPS"}</p>
          <h2 id="tip-title">{isRu ? "Оставишь на чай? =)" : "A cup of tea? =)"}</h2>
          <p>{isRu ? "Если инструмент пригодился, можешь поддержать разработку любой суммой. Просто спасибо — тоже отлично." : "If the instrument helps your music, you can support development with any amount. A simple thank you is lovely, too."}</p>
          {tipHref ? <a className={styles.secondaryButton} href={tipHref} target="_blank" rel="noreferrer">{isRu ? "Оставить на чай" : "Leave a tip"}<span aria-hidden="true">↗</span></a> : null}
          <p className={styles.fine}>{isRu ? "Чаевые добровольные. Скачивание всегда бесплатное." : "Tips are optional. The download is always free."}</p>
        </aside>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}><p className={styles.eyebrow}>FAQ</p><h2>{isRu ? "Перед первым басом" : "Before your first bass"}</h2></header>
        <div className={styles.faq}>
          <details><summary>{isRu ? "Нужно платить или регистрироваться?" : "Do I need to pay or sign up?"}</summary><p>{isRu ? "Нет. Нажми «Скачать бесплатно» и установи плагин. Чаевые полностью добровольные и не влияют на доступ или возможности." : "No. Download the installer and install the plugin. Tips are entirely optional and do not affect access or features."}</p></details>
          <details><summary>{isRu ? "Как установить и начать играть?" : "How do I install and start playing?"}</summary><p>{isRu ? "Запусти установщик с правами администратора. Добавь HPDG 808 на инструментальную дорожку в DAW и сыграй MIDI-ноту. Если плагин не появился, пересканируй VST3. Standalone запускается отдельно, без DAW." : "Run the installer with administrator rights. Add HPDG 808 to an instrument track in your DAW and play a MIDI note. Rescan VST3 plugins if it does not appear. The Standalone runs on its own, without a DAW."}</p></details>
          <details><summary>{isRu ? "Какие системы поддерживаются?" : "Which systems are supported?"}</summary><p>{isRu ? "Windows 10 и 11, 64-бит. Форматы VST3 и Standalone. Для VST3 нужна совместимая DAW. Версий для macOS, AU и AAX в этом релизе нет." : "Windows 10 and 11, 64-bit. VST3 and Standalone. The VST3 plugin needs a compatible host. This release does not include macOS, AU or AAX versions."}</p></details>
          <details><summary>{isRu ? "Нужен ли мне HPDG?" : "Do I need HPDG?"}</summary><p>{isRu ? "Нет, HPDG 808 — самостоятельный инструмент. Его можно использовать отдельно от генератора барабанов HPDG." : "No. HPDG 808 is a separate instrument and works independently of the HPDG drum generator."}</p></details>
          <details><summary>{isRu ? "Как перенести бас в проект?" : "How do I get the bass into my project?"}</summary><p>{isRu ? "Сыграй ноту, затем перетащи её кнопкой DRAG на дорожку или сохрани через EXPORT WAV. Экспортируется последняя сыгранная нота со всей мастер-обработкой, в стерео WAV 48 кГц." : "Play a note, then use DRAG to drop it onto a track or save it with EXPORT WAV. The last played note is exported with the master processing as a 48 kHz stereo WAV."}</p></details>
        </div>
      </section>
      <Link className={styles.related} href={`/${locale}/vst/hpdg`}>
        <div><span className={styles.eyebrow}>HAMLOPROD / HPDG</span><h3>{isRu ? "Нужны ещё и барабаны?" : "Need drums with that bass?"}</h3><p>{isRu ? "Открой генератор барабанов и баса HPDG." : "Explore the HPDG drum and bass generator."}</p></div><span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
