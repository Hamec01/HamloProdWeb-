import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AdminPostCrudManager } from "@/components/admin/admin-post-crud-manager";
import { PostRichContent } from "@/components/posts/post-rich-content";
import { getAdminSessionState } from "@/lib/auth/session";
import { localizePosts } from "@/lib/localize-content";
import { normalizeLocale } from "@/lib/market";
import { getAdminPosts, getPosts } from "@/services/content";
import styles from "./page.module.css";

/** Date of the built-in Beta 2 notes in the dev log (older than any post written after it). */
const BETA2_RELEASED_AT = Date.UTC(2026, 9, 13);

/** Stripe Payment Link for the "HPDG Beta" product (EUR 9.99, metadata product=hpdg). */
const buyHref =
  process.env.HPDG_BUY_URL?.trim() ||
  "https://buy.stripe.com/8x214pc2Y4mh5bw9YqcjS01";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const isRu = locale === "ru";

  return {
    title: isRu
      ? "HPDG Beta 2 — генератор барабанов и баса VST3"
      : "HPDG Beta 2 — Drum & Bass Generator VST3",
    description: isRu
      ? "HPDG генерирует барабаны и бас в стилях Boom Bap, Trap, DnB и Techno, анализирует семплы и экспортирует MIDI и WAV. Beta 2 для Windows 10/11."
      : "HPDG generates drums and bass for Boom Bap, Trap, DnB and Techno, analyzes samples, and exports MIDI and WAV. Beta 2 for Windows 10/11.",
    alternates: {
      canonical: `https://hamloprod.org/${locale}/vst`,
      languages: {
        en: "https://hamloprod.org/en/vst",
        ru: "https://hamloprod.org/ru/vst",
      },
    },
    openGraph: {
      type: "website",
      siteName: "HamloProd",
      title: "HPDG — Drum & Bass Generator VST3",
      description: isRu
        ? "Один клик — и готовы барабаны с басом. Beta 2 для Windows."
        : "One click writes drums and bass. Beta 2 for Windows.",
      images: [
        {
          url: "https://hamloprod.org/hpdg/img/og_cover.jpg",
          width: 1920,
          height: 1080,
          alt: "HPDG Drum & Bass Generator VST3",
        },
      ],
    },
  };
}

function Sequencer() {
  const rows = [
    { label: "HI-HAT", hits: [0, 2, 4, 6, 8, 10, 12, 14] },
    { label: "SNARE", hits: [4, 12] },
    { label: "KICK", hits: [0, 7, 10] },
    { label: "SUB 808", hits: [0, 3, 7, 10, 11] },
  ];

  return (
    <div className={styles.sequencer} aria-hidden="true">
      <div className={styles.seqHeader}>
        <span>BOOM BAP / CLASSIC</span>
        <span className={styles.bpm}>90 BPM</span>
      </div>
      <div className={styles.seqRows}>
        {rows.map((row) => (
          <div className={styles.seqRow} key={row.label}>
            <span className={styles.seqLabel}>{row.label}</span>
            <span className={styles.seqCells}>
              {Array.from({ length: 16 }, (_, index) => (
                <i className={row.hits.includes(index) ? styles.hit : ""} key={index} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.generateButton}>GENERATE PATTERN</div>
    </div>
  );
}

type Feature = {
  index: string;
  title: string;
  text: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  alt: string;
  note?: string;
};

type SupportTier = {
  price: string;
  name: string;
  description: string;
  includes: string[];
  image: string;
};

function FeatureBlock({ feature, flip = false }: { feature: Feature; flip?: boolean }) {
  return (
    <article className={`${styles.feature} ${flip ? styles.featureFlip : ""}`}>
      <div className={styles.featureCopy}>
        <span className={styles.index}>{feature.index}</span>
        <h3>{feature.title}</h3>
        <p>{feature.text}</p>
        {feature.note ? <p className={styles.featureNote}>{feature.note}</p> : null}
      </div>
      <figure className={styles.screenshot}>
        <Image
          src={feature.image}
          width={feature.imageWidth}
          height={feature.imageHeight}
          sizes="(max-width: 900px) 100vw, 58vw"
          alt={feature.alt}
        />
      </figure>
    </article>
  );
}

export default async function SectorVstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const isRu = locale === "ru";
  const [vstPosts, adminSession] = await Promise.all([getPosts("vst"), getAdminSessionState()]);
  const posts = await localizePosts(vstPosts, locale);
  const adminPosts = adminSession.isAuthenticated
    ? (await getAdminPosts()).filter((post) => post.section === "vst" || post.section === "general")
    : [];

  const features: Feature[] = isRu
    ? [
        {
          index: "01",
          title: "Четыре жанра. Не случайные ноты.",
          text: "Выбери Boom Bap, Trap, Drum & Bass или Techno и нажми Generate Pattern. У каждого подстиля свои правила грува, свинга и плотности, поэтому каждый результат звучит как новый бит в выбранной эстетике.",
          note: "Boom Bap · Trap · DnB · Techno",
          image: "/hpdg/img/boombap-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "HPDG генерирует паттерн Boom Bap",
        },
        {
          index: "02",
          title: "Стартуй от своего семпла",
          text: "Брось луп в Sample Analysis. HPDG определит темп, свинг, тональность и басовые ноты, а затем соберёт бит под этот материал. Луп и результат можно слушать вместе прямо в плагине.",
          image: "/hpdg/img/guide-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "Анализ семпла и Guide generation в HPDG",
        },
        {
          index: "03",
          title: "Разбери брейк на дорожки",
          text: "Copy Break распознаёт удары брейка и переносит их в Kick, Snare и Hi-Hat с исходным таймингом и свингом. После этого можно сменить звуки, квантизировать, добавить бас или мутировать паттерн.",
          image: "/hpdg/img/copybreak-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "Режим Copy Break в HPDG",
        },
        {
          index: "04",
          title: "Перетащи результат в DAW",
          text: "Экспортируй весь паттерн или отдельные дорожки как MIDI. Перетаскивай WAV уже со звуком и эффектами или сохраняй полный микс через Export Loop WAV.",
          image: "/hpdg/img/daw_drag-1600.webp",
          imageWidth: 1600,
          imageHeight: 900,
          alt: "Перетаскивание MIDI-паттерна из HPDG в DAW",
        },
      ]
    : [
        {
          index: "01",
          title: "Four genres. Not random notes.",
          text: "Choose Boom Bap, Trap, Drum & Bass or Techno and press Generate Pattern. Every substyle follows its own groove, swing and density rules, so each result sounds like a fresh beat in the chosen aesthetic.",
          note: "Boom Bap · Trap · DnB · Techno",
          image: "/hpdg/img/boombap-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "HPDG generating a Boom Bap pattern",
        },
        {
          index: "02",
          title: "Start from your sample",
          text: "Drop a loop into Sample Analysis. HPDG detects its tempo, swing, key and bass notes, then builds a beat around that material. Preview the loop and the generated beat together inside the plugin.",
          image: "/hpdg/img/guide-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "Sample Analysis and Guide generation in HPDG",
        },
        {
          index: "03",
          title: "Turn a break into lanes",
          text: "Copy Break detects the hits and moves them into Kick, Snare and Hi-Hat lanes with the original timing and swing. Swap sounds, quantize, add bass or mutate the pattern from there.",
          image: "/hpdg/img/copybreak-1600.webp",
          imageWidth: 1600,
          imageHeight: 833,
          alt: "Copy Break mode in HPDG",
        },
        {
          index: "04",
          title: "Drag the result into your DAW",
          text: "Export the full pattern or individual lanes as MIDI. Drag rendered WAV lanes with their sound and effects, or save the complete mix with Export Loop WAV.",
          image: "/hpdg/img/daw_drag-1600.webp",
          imageWidth: 1600,
          imageHeight: 900,
          alt: "Dragging a MIDI pattern from HPDG into a DAW",
        },
      ];

  const newItems = isRu
    ? [
        "Trim Sample: Loop / Play / Stop и курсор воспроизведения по клику на волну",
        "Selection = N bars: темп считается по точному количеству тактов",
        "Sub808 следует MIDI-нотам; − / + меняет октаву, Shift — полутон",
        "Скины Dark и Steel переключаются прямо из меню Skin",
        "Второй Techno-кит в эстетике tech house и 100 новых семплов",
      ]
    : [
        "Trim Sample: Loop / Play / Stop plus click-to-position playback",
        "Selection = N bars calculates tempo from an exact bar count",
        "Sub808 follows written MIDI notes; − / + changes octave, Shift changes semitone",
        "Dark and Steel skins switch directly from the Skin menu",
        "A second Techno kit focused on tech house, plus 100 new samples",
      ];

  const supportTiers: SupportTier[] = isRu
    ? [
        {
          price: "€9.99",
          name: "HPDG Beta 2",
          description: "Получи текущую закрытую бету HPDG для Windows по единой цене.",
          includes: ["HPDG 0.1.0 Beta 2", "VST3 и библиотека из 849 семплов"],
          image: "/hpdg/rewards/item_01.webp",
        },
      ]
    : [
        {
          price: "€9.99",
          name: "HPDG Beta 2",
          description: "Get the current closed HPDG beta for Windows at one clear price.",
          includes: ["HPDG 0.1.0 Beta 2", "VST3 and the 849-sample library"],
          image: "/hpdg/rewards/item_01.webp",
        },
      ];

  type DevlogEntry = { id: string; date: number; title: string; content: ReactNode };
  const formatDevlogDate = (time: number) =>
    new Intl.DateTimeFormat(isRu ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(time);
  const devlogEntries: DevlogEntry[] = [
    ...posts.map((post) => ({
      id: post.id,
      date: Date.parse(post.createdAt) || 0,
      title: post.title,
      content: (
        <div className={styles.newsGrid}>
          <article>
            <p>{post.category}</p><h3>{post.title}</h3><p>{post.excerpt}</p>
            <PostRichContent content={post.content} />
            {post.ctaLabel && post.ctaUrl ? <Link href={post.ctaUrl}>{post.ctaLabel} →</Link> : null}
          </article>
        </div>
      ),
    })),
    {
      id: "beta2",
      date: BETA2_RELEASED_AT,
      title: "HPDG 0.1.0 Beta 2",
      content: (
        <>
          <div className={styles.betaIntro}>
            <p className={styles.eyebrow}>0.1.0 / BETA 2</p>
            <h2>{isRu ? "Что нового" : "What’s new"}</h2>
            <p>{isRu ? "Beta 2 углубляет работу с семплами и басом, добавляет ещё один характер Techno и делает интерфейс гибче." : "Beta 2 deepens sample and bass control, adds another Techno character, and makes the interface more flexible."}</p>
          </div>
          <ol className={styles.updateList}>
            {newItems.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}
          </ol>
          <div className={styles.skinGrid}>
            {[
              ["Dark", "/hpdg/img/skin_dark-1600.webp"],
              ["Steel", "/hpdg/img/skin_steel-1600.webp"],
              ["Sketch", "/hpdg/img/skin_sketch-1600.webp"],
            ].map(([name, src]) => (
              <figure key={name}>
                <Image src={src} width={1600} height={833} sizes="(max-width: 800px) 100vw, 33vw" alt={`HPDG ${name} skin`} />
                <figcaption>{name}</figcaption>
              </figure>
            ))}
          </div>
        </>
      ),
    },
  ].sort((a, b) => b.date - a.date);
  const [latestEntry, ...olderEntries] = devlogEntries;

  const devlogSection = (
      <section className={styles.devlog} id="devlog">
        <header className={styles.sectionHeader}>
          <span>DEV LOG</span>
          <h2>{isRu ? "Дневник разработки" : "Dev log"}</h2>
        </header>
        {latestEntry ? (
          <div className={styles.devlogLatest} id={latestEntry.id === "beta2" ? "beta2" : undefined}>
            <time className={styles.devlogDate}>{formatDevlogDate(latestEntry.date)}</time>
            {latestEntry.content}
          </div>
        ) : null}
        {olderEntries.length ? (
          <div className={styles.devlogArchive}>
            <p className={styles.devlogArchiveLabel}>{isRu ? "Старые версии · дневник разработчика" : "Earlier versions · developer diary"}</p>
            {olderEntries.map((entry) => (
              <details key={entry.id} className={styles.devlogItem} id={entry.id === "beta2" ? "beta2" : undefined}>
                <summary>
                  <span>{entry.title}</span>
                  <time>{formatDevlogDate(entry.date)}</time>
                </summary>
                <div className={styles.devlogBody}>{entry.content}</div>
              </details>
            ))}
          </div>
        ) : null}
      </section>
  );

  return (
    <div className={styles.page}>
      <nav className={styles.localNav} aria-label={isRu ? "Разделы страницы" : "Page sections"}>
        <a href="#features">{isRu ? "Возможности" : "Features"}</a>
        <a href="#video">{isRu ? "Видео" : "Video"}</a>
        <a href="#devlog">{isRu ? "Дневник" : "Dev log"}</a>
        <a href="#support">{isRu ? "Получить бету" : "Get the beta"}</a>
      </nav>

      <section className={styles.hero}>
        <Image className={styles.heroMark} src="/hpdg/img/logo_white.webp" width={850} height={1024} alt="" priority />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BETA 2 · WINDOWS 10/11 · VST3</p>
            <Image className={styles.heroLogo} src="/hpdg/img/logo_white.webp" width={106} height={128} alt="HPDG" priority />
            <h1>HPDG</h1>
            <p className={styles.heroSubtitle}>DRUM &amp; BASS GENERATOR VST3</p>
            <p className={styles.heroLead}>
              {isRu
                ? "Один клик — и готовы барабаны с басом. Начни с жанра или брось свой луп: HPDG соберёт бит в его темпе и тональности."
                : "One click writes drums and bass. Start with a genre or drop in your own loop: HPDG builds a beat in its tempo and key."}
            </p>
            <ul className={styles.heroBullets}>
              <li>Boom Bap · Trap · DnB · Techno</li>
              <li>{isRu ? "849 аудиосемплов внутри" : "849 included audio samples"}</li>
              <li>{isRu ? "MIDI и WAV — прямо в DAW" : "MIDI and WAV — straight into your DAW"}</li>
            </ul>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#support">
                {isRu ? "Купить Beta 2 за €9.99" : "Buy Beta 2 for €9.99"}<span>↓</span>
              </a>
              <a className={styles.secondaryButton} href="#video">
                <span aria-hidden="true">▶</span>{isRu ? "Смотреть видео" : "Watch the demo"}
              </a>
            </div>
            <p className={styles.heroMeta}>
              {isRu ? "Версия 0.1.0-beta.2 · Windows x64 · цифровая доставка" : "Version 0.1.0-beta.2 · Windows x64 · digital delivery"}
            </p>
          </div>
          <Sequencer />
        </div>
      </section>

      <section className={styles.trustStrip} aria-label={isRu ? "Основные факты" : "Key facts"}>
        <div><strong>4</strong><span>{isRu ? "жанра" : "genres"}</span></div>
        <div><strong>849</strong><span>{isRu ? "семплов" : "samples"}</span></div>
        <div><strong>MIDI + WAV</strong><span>{isRu ? "экспорт" : "export"}</span></div>
        <div><strong>€9.99</strong><span>{isRu ? "цена Beta 2" : "Beta 2 price"}</span></div>
      </section>

      <section className={styles.videoSection} id="video">
        <header className={styles.sectionHeader}>
          <span>LIVE / 03:41</span>
          <h2>{isRu ? "Посмотри, как это звучит" : "See and hear it in action"}</h2>
          <p>{isRu ? "Каждый экран и каждый звук в этом видео — настоящий плагин." : "Every screen and every sound in this video comes from the real plugin."}</p>
        </header>
        <div className={styles.videoFrame}>
          <video controls preload="none" playsInline poster="/hpdg/img/poster.jpg">
            <source src="/hpdg/video/hpdg_demo_720p.mp4" type="video/mp4" media="(max-width: 900px)" />
            <source src="/hpdg/video/hpdg_demo_1080p.mp4" type="video/mp4" />
            <a href="/hpdg/video/hpdg_demo_720p.mp4">HPDG demo MP4</a>
          </video>
        </div>
      </section>

      <section className={styles.features} id="features">
        <header className={styles.sectionHeader}>
          <span>WORKFLOW</span>
          <h2>{isRu ? "От идеи до дорожки" : "From idea to track"}</h2>
          <p>{isRu ? "Генерируй основу, направляй грув своим семплом и забирай результат в привычный проект." : "Generate the foundation, guide the groove with your sample, and move the result into your project."}</p>
        </header>
        {features.map((feature, index) => <FeatureBlock feature={feature} flip={index % 2 === 1} key={feature.index} />)}
      </section>

      <section className={styles.lanes}>
        <div className={styles.lanesCopy}>
          <span className={styles.index}>05</span>
          <h2>{isRu ? "Каждая дорожка под контролем" : "Every lane under control"}</h2>
          <ul>
            <li>{isRu ? "RG перегенерирует только выбранную дорожку" : "RG regenerates only the selected lane"}</li>
            <li>{isRu ? "Lock, Solo, Mute и Clear на каждой дорожке" : "Lock, Solo, Mute and Clear on every lane"}</li>
            <li>{isRu ? "Отдельная громкость, звук, MIDI и WAV" : "Independent volume, sound, MIDI and WAV"}</li>
            <li>{isRu ? "Mutate делает небольшую вариацию всего бита" : "Mutate creates a subtle variation of the full beat"}</li>
          </ul>
        </div>
        <figure className={styles.lanesImage}>
          <Image src="/hpdg/img/tut_2_lanes-1160.webp" width={1160} height={548} sizes="(max-width: 900px) 100vw, 62vw" alt={isRu ? "Органы управления дорожками Kick и Sub808" : "Kick and Sub808 lane controls"} />
        </figure>
      </section>

      {devlogSection}

      <section className={styles.supportSection} id="support">
        <div className={styles.supportIntro}>
          <p className={styles.eyebrow}>{isRu ? "ПОДДЕРЖКА / РАННИЙ ДОСТУП" : "SUPPORT / EARLY ACCESS"}</p>
          <h2>{isRu ? "Получи Beta 2" : "Get Beta 2"}</h2>
          <p>
            {isRu
              ? "HPDG Beta 2 стоит €9.99. После оплаты ключ лицензии приходит на email, указанный в Stripe."
              : "HPDG Beta 2 costs €9.99. After payment, your license key is sent to the email used in Stripe."}
          </p>
        </div>
        <div className={styles.tierGrid}>
          {supportTiers.map((tier) => (
            <article className={styles.tierCard} key={tier.price}>
              <Image src={tier.image} width={696} height={464} sizes="(max-width: 700px) 100vw, 33vw" alt="" />
              <div className={styles.tierBody}>
                <p className={styles.tierPrice}>{tier.price}</p>
                <h3>{tier.name}</h3>
                <p className={styles.tierDescription}>{tier.description}</p>
                <ul>
                  {tier.includes.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <a className={styles.tierButton} href={buyHref} target="_blank" rel="noreferrer">
                  {isRu ? `Купить за ${tier.price}` : `Buy for ${tier.price}`}<span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
          ))}
        </div>
        <div className={styles.supportNote}>
          <strong>{isRu ? "Как это работает" : "How it works"}</strong>
          <p>
            {isRu
              ? "Оплати на странице Stripe и укажи email. В течение 24 часов на него придёт ключ лицензии: с ним скачай HPDG на hamloprod.org/hpdg/download и введи ключ один раз в плагине — новые версии будут приходить через кнопку Update."
              : "Pay on Stripe and enter your email. Within 24 hours you get a license key: download HPDG at hamloprod.org/hpdg/download and enter the key once in the plugin — new versions then arrive through its Update button."}
          </p>
          <span>Windows 10/11 x64 · VST3 · {isRu ? "без macOS / AU" : "no macOS / AU"}</span>
        </div>
      </section>

      <section className={styles.faq}>
        <header className={styles.sectionHeader}>
          <span>FAQ / STATUS</span>
          <h2>{isRu ? "Честно о бете" : "An honest beta"}</h2>
        </header>
        <div className={styles.faqGrid}>
          <details open>
            <summary>{isRu ? "Это уже рабочий плагин?" : "Is this a working plugin?"}</summary>
            <p>{isRu ? "Да. Все четыре движка генерации работают, установщик и библиотека входят в релиз. Это всё ещё бета: сохраняй проекты и сообщай об ошибках с версией DAW, Windows, жанром и шагами воспроизведения." : "Yes. All four generation engines work, and the release includes an installer and factory library. It is still a beta: save your projects and report issues with your DAW version, Windows version, genre and reproduction steps."}</p>
          </details>
          <details>
            <summary>{isRu ? "Нужен ли интернет или ключ?" : "Do I need internet or a license key?"}</summary>
            <p>{isRu ? "Для работы плагина не нужны ни интернет, ни активация. Ключ лицензии нужен только чтобы скачивать HPDG и получать обновления через кнопку Update." : "The plugin runs without an internet connection or activation. Your license key is only used to download HPDG and to get updates through the Update button."}</p>
          </details>
          <details>
            <summary>{isRu ? "Есть версия для macOS или AU?" : "Is there a macOS or AU version?"}</summary>
            <p>{isRu ? "Нет. Текущая Beta 2 — только VST3 для Windows 10/11 x64. macOS и AU пока не обещаются." : "No. The current Beta 2 is VST3 only for Windows 10/11 x64. macOS and AU are not currently promised."}</p>
          </details>
          <details>
            <summary>{isRu ? "Что входит в библиотеку?" : "What is included in the library?"}</summary>
            <p>{isRu ? "Полная фабричная библиотека содержит 849 аудиосемплов. Beta 2 добавляет 100 новых семплов и второй набор Techno в эстетике tech house." : "The complete factory library contains 849 audio samples. Beta 2 adds 100 new samples and a second Techno kit focused on tech house."}</p>
          </details>
          <details>
            <summary>{isRu ? "Как я получу Beta 2 после оплаты?" : "How will I receive Beta 2 after payment?"}</summary>
            <p>{isRu ? "Ключ лицензии приходит на email, указанный в Stripe; с ним HPDG скачивается на hamloprod.org/hpdg/download. Стоимость — €9.99." : "Your license key is sent to the email used in Stripe; with it you download HPDG at hamloprod.org/hpdg/download. The price is €9.99."}</p>
          </details>
        </div>
      </section>

      {adminSession.isAuthenticated ? (
        <section className={styles.adminSection}>
          <p>{isRu ? "Управление VST-постами" : "VST post management"}</p>
          <AdminPostCrudManager posts={adminPosts} />
        </section>
      ) : null}
    </div>
  );
}
