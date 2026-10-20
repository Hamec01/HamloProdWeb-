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

/** Stripe Payment Link for the "HPDG Beta" product (EUR 9.99, metadata product=hpdg). */
const buyHref =
  process.env.HPDG_BUY_URL?.trim() ||
  "https://buy.stripe.com/8x214pc2Y4mh5bw9YqcjS01";

/** Page media live in the public Contabo bucket under hpdg/site/ (allowed in next.config remotePatterns). */
const MEDIA = `${(
  process.env.S3_PUBLIC_BASE_URL?.trim() ||
  "https://usc1.contabostorage.com/e83fedb37f3543d0bc6c23caf78439e5:hamloprod-public"
).replace(/\/+$/, "")}/hpdg/site`;
const media = (path: string) => `${MEDIA}/${path}`;

const VERSION_LABEL = "0.1.0 Beta 6";
const PRICE = "€9.99";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const isRu = normalizeLocale(rawLocale) === "ru";
  const locale = isRu ? "ru" : "en";

  return {
    title: isRu ? "HPDG Beta 6 — генератор барабанов и баса VST3" : "HPDG Beta 6 — Drum & Bass Generator VST3",
    description: isRu
      ? "HPDG генерирует барабаны и бас прямо в DAW: Boom Bap, Trap, DnB, Techno и Atmospheric, бит под твой луп, MIDI и WAV в один клик. VST3 для Windows."
      : "HPDG generates drums and bass in your DAW: Boom Bap, Trap, DnB, Techno and Atmospheric, beats built around your loop, MIDI and WAV in one drag. VST3 for Windows.",
    alternates: {
      canonical: `https://hamloprod.org/${locale}/vst`,
      languages: { en: "https://hamloprod.org/en/vst", ru: "https://hamloprod.org/ru/vst" },
    },
    openGraph: {
      type: "website",
      siteName: "HamloProd",
      title: "HPDG — HamloProd Drum Generator · VST3",
      description: isRu
        ? "Барабаны и бас для твоих битов — прямо в DAW. Beta 6 для Windows."
        : "Drums and bass for your beats, generated in your DAW. Beta 6 for Windows.",
      images: [{ url: media("beta6/video-poster.jpg"), width: 1920, height: 1080, alt: "HPDG Drum Generator VST3" }],
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

type Shot = { src: string; width: number; height: number; alt: string };

type Feature = {
  index: string;
  title: string;
  text: string;
  bullets?: string[];
  shot: Shot;
};

function FeatureBlock({ feature, flip = false }: { feature: Feature; flip?: boolean }) {
  return (
    <article className={`${styles.feature} ${flip ? styles.featureFlip : ""}`}>
      <div className={styles.featureCopy}>
        <span className={styles.index}>{feature.index}</span>
        <h3>{feature.title}</h3>
        <p>{feature.text}</p>
        {feature.bullets ? (
          <ul className={styles.featureList}>
            {feature.bullets.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
      </div>
      <figure className={styles.screenshot}>
        <Image src={feature.shot.src} width={feature.shot.width} height={feature.shot.height} sizes="(max-width: 900px) 100vw, 58vw" alt={feature.shot.alt} />
      </figure>
    </article>
  );
}

const GENRES = [
  { name: "Boom Bap", styles: ["Classic", "Dusty", "Jazzy", "Boom Bap Gold", "Russian Underground", "Lo-fi Rap"] },
  { name: "Trap", styles: ["ATL Classic", "Dark", "Cloud", "Rage", "Memphis", "Luxury"] },
  { name: "DnB", styles: ["Modern", "Roller", "Liquid", "Neurofunk", "Jump-Up", "Breakbeat"] },
  { name: "Techno", styles: ["Peak Time", "Hypnotic", "Minimal", "Detroit", "Dub", "Acid", "Hard"] },
  { name: "Atmospheric", styles: ["Pulse", "Two-Step", "Broken"] },
];

export default async function SectorVstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const isRu = locale === "ru";
  const [vstPosts, adminSession] = await Promise.all([getPosts("vst"), getAdminSessionState()]);
  const posts = await localizePosts(vstPosts, locale);
  const adminPosts = adminSession.isAuthenticated
    ? (await getAdminPosts()).filter((post) => post.section === "vst" || post.section === "general")
    : [];

  const t = isRu
    ? {
        nav: ["Возможности", "Видео", "Обновления", "Что нового", "Купить"],
        heroLead: "Барабаны и бас для твоих битов — прямо в DAW. VST3 для Windows.",
        heroBullets: [
          "Пять жанров, 28 стилей: Boom Bap, Trap, DnB, Techno, Atmospheric",
          "Собирает бит под твой луп или копирует брейк",
          "Перетаскивай MIDI или WAV прямо в любую DAW",
        ],
        heroBuy: `Купить HPDG — ${PRICE}`,
        heroVideo: "Смотреть видео",
        heroMeta: `Версия ${VERSION_LABEL} · Windows 10/11 64-bit · VST3 · без активации`,
        trust: [["5", "жанров"], ["28", "стилей"], ["913", "семплов"], [PRICE, "Beta 6"]],
        videoTitle: "Посмотри, как это звучит",
        videoText: "Каждый экран и каждый звук в этом видео — настоящий плагин Beta 6.",
        aboutTitle: "Что такое HPDG",
        about: [
          "HPDG пишет барабанные партии и бас за тебя. Выбери жанр и стиль, нажми Generate Pattern — и в сетке появится полный бит: кик, снейр, хэты, перкуссия, тарелки и линия 808 или баса, сразу со своими звуками.",
          "Слушай, меняй то, что не нравится — одну дорожку или весь бит, — и перетаскивай результат в DAW как MIDI или аудио. У каждого стиля свои правила грува, свинга, плотности и сбивок, поэтому каждый клик даёт новый бит в том же стиле, а не случайные ноты.",
        ],
        aboutAlt: "HPDG с бит-паттерном Trap на сетке",
        genresTitle: "Жанры и стили",
        genresNotes: [
          ["Trap", "Роллы и триоли хэтов, линии 808 на всю фразу с глайдами, снейры в half-time."],
          ["Techno", "Прямая бочка, хэты на офбитах, перкуссия, свои басовые звуки (включая tech-house кит)."],
          ["Atmospheric", "Ритмы Pulse, Two-Step и Broken с мелодичным басом над минорной гармонией и свой кит барабанов и баса."],
        ],
        genresAlt: "Жанр Atmospheric в HPDG",
        workflowTitle: "От идеи до дорожки",
        workflowText: "Генерируй основу, направляй грув своим семплом и забирай результат в свой проект.",
        sampleTitle: "Стартуй от своего семпла",
        sampleText: "Брось луп или семпл в Sample Analysis (WAV, AIFF, FLAC, MP3). HPDG измерит темп, свинг и тональность, найдёт басовые ноты и соберёт бит под этот материал: тот же темп, бас в нужной тональности, грув, который садится на луп. Play w/ HPDG играет твой луп и бит вместе прямо в плагине, со своей громкостью.",
        sampleBullets: [
          "Trim — выбери нужный кусок файла: Loop / Play / Stop, тяни края или впиши «Selection = N bars», и темп подстроится.",
          "Guide generation (по умолчанию) — анализ направляет генератор.",
        ],
        sampleAlt: "Анализ семпла и Guide generation в HPDG",
        breakTitle: "Разбери брейк на дорожки",
        breakText: "Режим Copy break (K/S/H): брось барабанный брейк, и HPDG расшифрует его удар за ударом в дорожки Kick, Snare и Hi-Hat с исходным таймингом и свингом. Дальше меняй звуки, квантуй сколько хочешь (Quantize), добавь бас, мутируй.",
        breakAlt: "Режим Copy break в HPDG",
        dawTitle: "Прямо в DAW",
        dawText: "Всё, что получилось, уходит в проект одним перетаскиванием.",
        dawBullets: [
          "Drag Full — перетащи весь паттерн на MIDI-дорожку. Export Full сохраняет его MIDI-файлом.",
          "Кнопка MIDI на дорожке тащит только её партию, кнопка WAV — партию уже со звуком.",
          "Export Loop WAV сохраняет весь микс аудиолупом.",
          "Пока тянешь файл, окно плагина отходит в сторону (FL Studio и другие).",
          "Всё сохраняется вместе с проектом DAW; Presets хранят понравившиеся настройки.",
        ],
        dawAlt: "Перетаскивание MIDI-паттерна из HPDG в DAW",
        lanesTitle: "Каждая дорожка под контролем",
        lanesText: "Каждый инструмент — своя дорожка: HiHat, Hat Accent, OpenHat, Snare, Kick, Kick Ghost, Ride, Cymbal, Sub808. Ещё дорожки — кнопкой + Lane.",
        lanes: [
          "RG перегенерирует одну дорожку и оставляет остальные; Mutate делает вариацию всего бита.",
          "S — Solo, M — Mute, L — Lock (защитить дорожку от изменений), C — Clear; < > листают звуки кита.",
          "Strength на каждой дорожке: влево убирает самые слабые удары, вправо добавляет типичные для жанра. На хэтах Trap сначала уходят роллы, четверти остаются.",
          "Intensity 1–5 для всего рэка: 1 — самый простой бит, 5 — самый плотный.",
          "Sub808: количество баса 1 / 2 / 3, – / + сдвигают октаву (Shift — полутон, MIDI-экспорт это сохраняет). По умолчанию играет свой синт-саб HPDG (4 варианта).",
          "Rack Vol для всего кита; в сетке паттерна удары можно рисовать и править вручную.",
        ],
        lanesAlt: "Ручка Strength на дорожке HiHat: роллы убраны",
        grooveTitle: "Настрой грув",
        grooveText: "BPM (с Lock и Sync к темпу DAW), Swing, Density, Bars (1, 2, 4, 8, 16), Tempo Mode (Auto, Original, Half-time), Snap (от 1/4 до 1/64, триоли, Adaptive, Micro), Seed (точно повторить генерацию), Playback (Play Flag или Loop Range), Start play with DAW. В расширенном виде — ещё Velocity, Timing и Humanize.",
        skinsTitle: "Три скина",
        skinsText: "Dark, Steel и Sketch — переключаются в любой момент из меню SKIN.",
        updatesTitle: "Обновления прямо в плагине",
        updatesText: "Рядом с версией в шапке плагина есть маленькая кнопка Update.",
        updates: [
          "Нажми её: HPDG спросит у hamloprod.org, вышла ли новая версия — Latest, Update: <версия> или Offline.",
          "Если вышла, нажми ещё раз и один раз введи ключ лицензии. HPDG скачает установщик, проверит, что он целый и не изменён (SHA-256), и запустит его после подтверждения. Сначала сохрани проект: установщик попросит закрыть DAW.",
          "Нажми HPDG в шапке — откроется меню: Update, Instruction (руководство), Site.",
          "Нет интернета? HPDG работает как обычно.",
        ],
        keyTitle: "Ключ лицензии",
        keyText: "Выглядит как HPDG-XXXX-XXXX-XXXX-XXXX и приходит на email, с которого ты покупал HPDG. Он нужен только для скачивания и обновлений — все функции работают без него, активации нет. Потерял ключ? Напиши на hello@hamloprod.org с email покупки.",
        updatesAlt: "Шапка HPDG с кнопкой Update рядом с версией",
        reqTitle: "Требования и установка",
        req: [
          "Windows 10 / 11, 64-bit; 64-битная DAW с поддержкой VST3. Проверено в FL Studio.",
          "Один установщик (~110 МБ): плагин, 913 фабричных семплов и Visual C++ Runtime. Больше ничего качать не нужно, аккаунт не нужен.",
          "Ставится в C:\\Program Files\\Common Files\\VST3\\HPDG.vst3 — после установки пересканируй VST3-плагины в DAW.",
          "Формат: только VST3, только Windows.",
        ],
        devlogTitle: "Что нового",
        devlogArchive: "Старые версии · дневник разработчика",
        releaseNotes: "список изменений",
        changelog: [
          { version: "0.1.0 Beta 6", items: ["Установщик и руководство на английском.", "В FAQ объяснено, что такое ключ лицензии."] },
          { version: "0.1.0 Beta 5", items: ["Кнопка Update и обновления прямо в плагине по ключу лицензии.", "Меню HPDG: Update, Instruction, Site."] },
          {
            version: "0.1.0 Beta 3",
            items: [
              "Новый жанр Atmospheric (64 новых семпла).",
              "Intensity 1–5 и ручка Strength на каждой дорожке.",
              "808 в Trap в правильном регистре и с глайдами; синт-саб HPDG по умолчанию.",
              "Окно отходит в сторону, пока тянешь файл в DAW; Guide generation по умолчанию.",
            ],
          },
        ],
        beta2Intro: "Beta 2 углубила работу с семплами и басом, добавила ещё один характер Techno и сделала интерфейс гибче.",
        beta2Items: [
          "Trim Sample: Loop / Play / Stop и курсор воспроизведения по клику на волну",
          "Selection = N bars: темп считается по точному количеству тактов",
          "Sub808 следует MIDI-нотам; − / + меняет октаву, Shift — полутон",
          "Скины Dark и Steel переключаются прямо из меню Skin",
          "Второй Techno-кит в эстетике tech house и 100 новых семплов",
        ],
        buyEyebrow: "РАННИЙ ДОСТУП",
        buyTitle: "Купить HPDG",
        buyText: `HPDG ${VERSION_LABEL} стоит ${PRICE}. После оплаты на email из Stripe приходит ключ лицензии.`,
        tierDescription: "Текущая бета HPDG для Windows и обновления через кнопку Update.",
        tierIncludes: ["VST3-плагин и 913 фабричных семплов (один установщик ~110 МБ)", "Ключ лицензии на email — обновления прямо в плагине", "Windows 10/11 64-bit · без активации"],
        tierButton: `Купить за ${PRICE}`,
        howTitle: "Как это работает",
        how: "Оплати на странице Stripe и укажи email. На него придёт ключ лицензии: с ним скачай HPDG на hamloprod.org/hpdg/download и введи ключ один раз в плагине — дальше новые версии приходят через кнопку Update. Вопросы: hello@hamloprod.org.",
        honest: "Честно: HPDG — бета. Делай бэкапы проектов и пиши нам об ошибках (версия HPDG, Windows, DAW, жанр, стиль, BPM, Seed и шаги).",
        faqTitle: "Частые вопросы",
        faq: [
          ["Нужен ли интернет или активация?", "Нет. Кнопка Update выходит в интернет только когда ты проверяешь или скачиваешь обновление."],
          ["Какие DAW поддерживаются?", "Проверено в FL Studio. Должна работать любая 64-битная DAW для Windows, которая загружает VST3 — если что-то не так, напиши нам."],
          ["Можно ли продавать и выпускать биты, сделанные в HPDG?", "Да. Паттерны, MIDI и аудио, которые ты делаешь в HPDG, — включая встроенные звуки внутри твоих треков — твои: выпускай и продавай их без отчислений. Нельзя только перепродавать или раздавать сами фабричные семплы (как семпл-пак или кит)."],
          ["Есть версия для Mac?", "Нет. HPDG — VST3-плагин только для Windows."],
          ["Как получить HPDG после оплаты?", "Ключ лицензии приходит на email, указанный в Stripe. С ним HPDG скачивается на hamloprod.org/hpdg/download."],
          ["Как обновиться?", "Нажми Update в шапке плагина. Или запусти новый установщик поверх старого — проекты и настройки сохранятся."],
          ["Как удалить?", "Параметры Windows → Приложения → HPDG VST3."],
        ],
        adminLabel: "Управление VST-постами",
      }
    : {
        nav: ["Features", "Video", "Updates", "What's new", "Get HPDG"],
        heroLead: "Drums and bass for your beats, generated in your DAW. VST3 for Windows.",
        heroBullets: [
          "Five genres, 28 styles: Boom Bap, Trap, DnB, Techno, Atmospheric",
          "Builds a beat around your own loop or copies a drum break",
          "Drag MIDI or WAV straight into any DAW",
        ],
        heroBuy: `Get HPDG — ${PRICE}`,
        heroVideo: "Watch the video",
        heroMeta: `Version ${VERSION_LABEL} · Windows 10/11 64-bit · VST3 · no activation`,
        trust: [["5", "genres"], ["28", "styles"], ["913", "samples"], [PRICE, "Beta 6"]],
        videoTitle: "See and hear it in action",
        videoText: "Every screen and every sound in this video comes from the real Beta 6 plugin.",
        aboutTitle: "What HPDG is",
        about: [
          "HPDG writes drum patterns and a bass line for you. Pick a genre and a style, press Generate Pattern, and a full beat appears in the grid: kick, snare, hats, percussion, cymbals and an 808 or bass line, already playing with its own sounds.",
          "Listen, change what you don't like — one lane or the whole beat — and drag the result into your DAW as MIDI or audio. Every style has its own rules for groove, swing, density and fills, so each click gives a new beat in the same style, not random notes.",
        ],
        aboutAlt: "HPDG with a Trap pattern in the grid",
        genresTitle: "Genres and styles",
        genresNotes: [
          ["Trap", "Hi-hat rolls and triplets, 808 lines across the whole phrase with glides, half-time snares."],
          ["Techno", "Four-on-the-floor kick, off-beat hats, percussion, its own bass sounds (including a tech-house kit)."],
          ["Atmospheric", "Pulse, Two-Step and Broken rhythms with a melodic bass over minor harmony and its own drum and bass kit."],
        ],
        genresAlt: "The Atmospheric genre in HPDG",
        workflowTitle: "From idea to track",
        workflowText: "Generate the foundation, guide the groove with your sample, and move the result into your project.",
        sampleTitle: "Start from your sample",
        sampleText: "Drop a loop or a sample into Sample Analysis (WAV, AIFF, FLAC, MP3). HPDG measures its tempo, swing and key and finds the bass notes, then builds the beat for that sample: the same tempo, a bass line in the right key, a groove that sits with the loop. Play w/ HPDG plays your loop and the beat together inside the plugin, with its own volume, before you export anything.",
        sampleBullets: [
          "Trim — pick the part of the file you need: Loop / Play / Stop, drag the edges, or type “Selection = N bars” and the tempo follows.",
          "Guide generation (default) — the analysis guides the generator.",
        ],
        sampleAlt: "Sample Analysis and Guide generation in HPDG",
        breakTitle: "Turn a break into lanes",
        breakText: "Copy break (K/S/H): drop a drum break and HPDG transcribes it hit by hit into Kick, Snare and Hi-Hat lanes with the original timing and swing. Then swap the sounds, quantize as much as you like (Quantize), add a bass line, mutate it.",
        breakAlt: "Copy break mode in HPDG",
        dawTitle: "Into your DAW",
        dawText: "Whatever you made goes into your project with one drag.",
        dawBullets: [
          "Drag Full — drag the whole pattern onto a MIDI track. Export Full saves it as a MIDI file.",
          "The MIDI button on a lane drags just that part; the WAV button drags it rendered with its sound.",
          "Export Loop WAV saves the full mix as an audio loop.",
          "While you drag, the plugin window steps aside once the file leaves it (FL Studio and others).",
          "Everything is saved with your DAW project; Presets keep settings you like.",
        ],
        dawAlt: "Dragging a MIDI pattern from HPDG into a DAW",
        lanesTitle: "Control every lane",
        lanesText: "Each instrument is one lane: HiHat, Hat Accent, OpenHat, Snare, Kick, Kick Ghost, Ride, Cymbal, Sub808 — add more with + Lane.",
        lanes: [
          "RG regenerates one lane and keeps the rest; Mutate makes a variation of the whole beat.",
          "S Solo, M Mute, L Lock (protect a lane from changes), C Clear; < > flip through the kit sounds.",
          "Strength per lane: left removes the weakest hits, right adds hits typical for the genre. On Trap hats it removes whole rolls first and keeps the quarter notes.",
          "Intensity 1–5 for the whole rack: 1 is the simplest beat, 5 the busiest.",
          "Sub808: bass amount 1 / 2 / 3, – / + shift the octave (Shift — a semitone; MIDI export keeps it). By default it plays HPDG's own synth sub (4 variants).",
          "Rack Vol for the whole kit; the pattern grid lets you draw and edit hits by hand.",
        ],
        lanesAlt: "Strength knob on the HiHat lane: rolls removed",
        grooveTitle: "Shape the groove",
        grooveText: "BPM (with Lock and Sync to the DAW tempo), Swing, Density, Bars (1, 2, 4, 8, 16), Tempo Mode (Auto, Original, Half-time), Snap (1/4 to 1/64, triplets, Adaptive, Micro), Seed (repeat a generation exactly), Playback (Play Flag or Loop Range), Start play with DAW. Advanced view adds Velocity, Timing and Humanize.",
        skinsTitle: "Three skins",
        skinsText: "Dark, Steel and Sketch — switch any time from the SKIN menu.",
        updatesTitle: "Updates inside the plugin",
        updatesText: "Next to the version in the header there is a small Update button.",
        updates: [
          "Click it: HPDG asks hamloprod.org whether a new version is out — Latest, Update: <version> or Offline.",
          "When a new version is out, click again and enter your license key once. HPDG downloads the installer, checks that it is complete and unchanged (SHA-256), and starts it when you confirm. Save your project first: the installer asks you to close the DAW.",
          "Click HPDG in the header for the menu: Update, Instruction (the guide), Site.",
          "No internet? HPDG works exactly as before.",
        ],
        keyTitle: "Your license key",
        keyText: "Looks like HPDG-XXXX-XXXX-XXXX-XXXX and comes by email to the address you used to buy HPDG. It is only for downloads and updates — every feature works without it, and there is no activation. Lost it? Write to hello@hamloprod.org from your purchase email.",
        updatesAlt: "HPDG header with the Update button next to the version",
        reqTitle: "Requirements and install",
        req: [
          "Windows 10 / 11, 64-bit; a 64-bit DAW with VST3 support. Tested in FL Studio.",
          "One installer (~110 MB): the plugin, 913 factory samples and the Visual C++ Runtime. Nothing else to download, no account.",
          "Installs to C:\\Program Files\\Common Files\\VST3\\HPDG.vst3 — rescan VST3 plugins in your DAW.",
          "Format: VST3 plugin only, Windows only.",
        ],
        devlogTitle: "What's new",
        devlogArchive: "Earlier versions · developer diary",
        releaseNotes: "release notes",
        changelog: [
          { version: "0.1.0 Beta 6", items: ["The installer and the guide in English.", "The FAQ explains the license key."] },
          { version: "0.1.0 Beta 5", items: ["The Update button and in-plugin updates with your license key.", "The HPDG menu: Update, Instruction, Site."] },
          {
            version: "0.1.0 Beta 3",
            items: [
              "New genre Atmospheric (64 new samples).",
              "Intensity 1–5 and a Strength knob on every lane.",
              "Trap 808 in the right register with glides; HPDG synth sub by default.",
              "The window steps aside while you drag into the DAW; Guide generation by default.",
            ],
          },
        ],
        beta2Intro: "Beta 2 deepened sample and bass control, added another Techno character, and made the interface more flexible.",
        beta2Items: [
          "Trim Sample: Loop / Play / Stop plus click-to-position playback",
          "Selection = N bars calculates tempo from an exact bar count",
          "Sub808 follows written MIDI notes; − / + changes octave, Shift changes semitone",
          "Dark and Steel skins switch directly from the Skin menu",
          "A second Techno kit focused on tech house, plus 100 new samples",
        ],
        buyEyebrow: "EARLY ACCESS",
        buyTitle: "Get HPDG",
        buyText: `HPDG ${VERSION_LABEL} costs ${PRICE}. After payment, your license key is sent to the email used in Stripe.`,
        tierDescription: "The current HPDG beta for Windows plus updates through the Update button.",
        tierIncludes: ["VST3 plugin and 913 factory samples (one ~110 MB installer)", "License key by email — updates right in the plugin", "Windows 10/11 64-bit · no activation"],
        tierButton: `Buy for ${PRICE}`,
        howTitle: "How it works",
        how: "Pay on Stripe and enter your email. Your license key arrives there: download HPDG at hamloprod.org/hpdg/download and enter the key once in the plugin — new versions then arrive through its Update button. Questions: hello@hamloprod.org.",
        honest: "Honest note: HPDG is in beta. Keep backups of your projects and tell us about bugs (HPDG version, Windows, DAW, genre, style, BPM, Seed and the steps).",
        faqTitle: "FAQ",
        faq: [
          ["Does it need internet or activation?", "No. The Update button uses the internet only when you check for or download an update."],
          ["Which DAWs?", "Tested in FL Studio. Any 64-bit Windows DAW that loads VST3 should work — tell us if something doesn't."],
          ["Can I sell and release beats made with HPDG?", "Yes. Patterns, MIDI and audio you make with HPDG — including the factory sounds inside your tracks — are yours to release and sell, royalty-free. You just can't resell or share the factory samples themselves (as a sample pack or kit)."],
          ["Is there a Mac version?", "No. HPDG is a VST3 plugin for Windows only."],
          ["How do I get HPDG after paying?", "Your license key is sent to the email used in Stripe. With it you download HPDG at hamloprod.org/hpdg/download."],
          ["How do I update?", "Press Update in the plugin header. Or run the new installer over the old one — projects and settings stay."],
          ["How do I uninstall?", "Windows Settings → Apps → HPDG VST3."],
        ],
        adminLabel: "VST post management",
      };

  const features: Feature[] = [
    { index: "01", title: t.sampleTitle, text: t.sampleText, bullets: t.sampleBullets, shot: { src: media("beta6/guide.webp"), width: 1600, height: 833, alt: t.sampleAlt } },
    { index: "02", title: t.breakTitle, text: t.breakText, shot: { src: media("beta6/copybreak.webp"), width: 1600, height: 833, alt: t.breakAlt } },
    { index: "03", title: t.dawTitle, text: t.dawText, bullets: t.dawBullets, shot: { src: media("beta6/daw-drag.webp"), width: 1600, height: 900, alt: t.dawAlt } },
  ];

  // Dev log: built-in release notes + VST/general posts, newest first. The newest entry is
  // always open; older ones are <details> (click opens, click again closes).
  // Built-in sort keys only order the notes among posts; they are not shown as dates.
  type DevlogEntry = { id: string; date: number; title: string; showDate: boolean; content: ReactNode };
  const formatDevlogDate = (time: number) =>
    new Intl.DateTimeFormat(isRu ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(time);
  const builtInSortKeys = [Date.UTC(2026, 9, 20, 12), Date.UTC(2026, 9, 20, 10), Date.UTC(2026, 9, 16)];
  const devlogEntries: DevlogEntry[] = [
    ...posts.map((post) => ({
      id: post.id,
      date: Date.parse(post.createdAt) || 0,
      title: post.title,
      showDate: true,
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
    ...t.changelog.map((release, index) => ({
      id: `release-${release.version}`,
      date: builtInSortKeys[index],
      title: `HPDG ${release.version}`,
      showDate: false,
      content: (
        <div className={styles.releaseNotes}>
          <ol className={styles.updateList}>
            {release.items.map((item, i) => <li key={item}><span>{String(i + 1).padStart(2, "0")}</span>{item}</li>)}
          </ol>
        </div>
      ),
    })),
    {
      id: "beta2",
      date: Date.UTC(2026, 9, 13),
      title: "HPDG 0.1.0 Beta 2",
      showDate: false,
      content: (
        <div className={styles.releaseNotes}>
          <p className={styles.releaseIntro}>{t.beta2Intro}</p>
          <ol className={styles.updateList}>
            {t.beta2Items.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}
          </ol>
          <div className={styles.skinGrid}>
            {(["Dark", "Steel", "Sketch"] as const).map((name) => (
              <figure key={name}>
                <Image src={media(`beta2/skin-${name.toLowerCase()}.webp`)} width={1600} height={833} sizes="(max-width: 800px) 100vw, 33vw" alt={`HPDG Beta 2 ${name} skin`} />
                <figcaption>{name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ),
    },
  ].sort((a, b) => b.date - a.date);
  const [latestEntry, ...olderEntries] = devlogEntries;
  const entryMeta = (entry: DevlogEntry) => (entry.showDate ? formatDevlogDate(entry.date) : t.releaseNotes);

  return (
    <div className={styles.page}>
      <nav className={styles.localNav} aria-label={isRu ? "Разделы страницы" : "Page sections"}>
        <a href="#features">{t.nav[0]}</a>
        <a href="#video">{t.nav[1]}</a>
        <a href="#updates">{t.nav[2]}</a>
        <a href="#devlog">{t.nav[3]}</a>
        <a href="#support">{t.nav[4]}</a>
      </nav>

      <section className={styles.hero}>
        <Image className={styles.heroMark} src={media("logo-white.webp")} width={850} height={1024} alt="" priority />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>BETA 6 · WINDOWS 10/11 · VST3</p>
            <Image className={styles.heroLogo} src={media("logo-white.webp")} width={106} height={128} alt="HPDG" priority />
            <h1>HPDG</h1>
            <p className={styles.heroSubtitle}>HAMLOPROD DRUM GENERATOR</p>
            <p className={styles.heroLead}>{t.heroLead}</p>
            <ul className={styles.heroBullets}>
              {t.heroBullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="#support">
                {t.heroBuy}<span>↓</span>
              </a>
              <a className={styles.secondaryButton} href="#video">
                <span aria-hidden="true">▶</span>{t.heroVideo}
              </a>
            </div>
            <p className={styles.heroMeta}>{t.heroMeta}</p>
          </div>
          <Sequencer />
        </div>
      </section>

      <section className={styles.trustStrip} aria-label={isRu ? "Основные факты" : "Key facts"}>
        {t.trust.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </section>

      <section className={styles.videoSection} id="video">
        <header className={styles.sectionHeader}>
          <span>LIVE / 03:01</span>
          <h2>{t.videoTitle}</h2>
          <p>{t.videoText}</p>
        </header>
        <div className={styles.videoFrame}>
          <video controls preload="none" playsInline poster={media("beta6/video-poster.jpg")}>
            <source src={media("beta6/hpdg-beta6-demo-720p.mp4")} type="video/mp4" media="(max-width: 900px)" />
            <source src={media("beta6/hpdg-beta6-demo-1080p.mp4")} type="video/mp4" />
            <a href={media("beta6/hpdg-beta6-demo-720p.mp4")}>HPDG Beta 6 demo (MP4)</a>
          </video>
        </div>
      </section>

      <section className={styles.aboutSection}>
        <div className={styles.aboutCopy}>
          <span className={styles.index}>HPDG</span>
          <h2>{t.aboutTitle}</h2>
          {t.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <figure className={styles.aboutShot}>
          <Image src={media("beta6/main-trap.webp")} width={1600} height={1003} sizes="(max-width: 900px) 100vw, 60vw" alt={t.aboutAlt} />
        </figure>
      </section>

      <section className={styles.genresSection} id="genres">
        <header className={styles.sectionHeader}>
          <span>5 GENRES / 28 STYLES</span>
          <h2>{t.genresTitle}</h2>
        </header>
        <div className={styles.genreGrid}>
          {GENRES.map((genre) => (
            <article key={genre.name} className={styles.genreCard}>
              <h3>{genre.name}</h3>
              <p>{genre.styles.join(" · ")}</p>
            </article>
          ))}
        </div>
        <div className={styles.genreDetail}>
          <ul className={styles.genreNotes}>
            {t.genresNotes.map(([name, text]) => <li key={name}><strong>{name}</strong>{text}</li>)}
          </ul>
          <figure className={styles.screenshot}>
            <Image src={media("beta6/atmospheric.webp")} width={1600} height={1003} sizes="(max-width: 900px) 100vw, 55vw" alt={t.genresAlt} />
          </figure>
        </div>
      </section>

      <section className={styles.features} id="features">
        <header className={styles.sectionHeader}>
          <span>WORKFLOW</span>
          <h2>{t.workflowTitle}</h2>
          <p>{t.workflowText}</p>
        </header>
        {features.map((feature, index) => <FeatureBlock feature={feature} flip={index % 2 === 1} key={feature.index} />)}
      </section>

      <section className={styles.lanes}>
        <div className={styles.lanesCopy}>
          <span className={styles.index}>04</span>
          <h2>{t.lanesTitle}</h2>
          <p className={styles.lanesLead}>{t.lanesText}</p>
          <ul>
            {t.lanes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <figure className={styles.lanesImage}>
          <Image src={media("beta6/lanes-strength.webp")} width={1600} height={1003} sizes="(max-width: 900px) 100vw, 62vw" alt={t.lanesAlt} />
        </figure>
      </section>

      <section className={styles.grooveSection}>
        <span className={styles.index}>05</span>
        <h2>{t.grooveTitle}</h2>
        <p>{t.grooveText}</p>
      </section>

      <section className={styles.skinsSection}>
        <header className={styles.sectionHeader}>
          <span>SKINS</span>
          <h2>{t.skinsTitle}</h2>
          <p>{t.skinsText}</p>
        </header>
        <div className={styles.skinGrid}>
          {(["Dark", "Steel", "Sketch"] as const).map((name) => (
            <figure key={name}>
              <Image src={media(`beta6/skin-${name.toLowerCase()}.webp`)} width={1500} height={940} sizes="(max-width: 800px) 100vw, 33vw" alt={`HPDG ${name} skin`} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.updatesSection} id="updates">
        <div className={styles.updatesCopy}>
          <span className={styles.index}>NEW · BETA 5–6</span>
          <h2>{t.updatesTitle}</h2>
          <p>{t.updatesText}</p>
          <ul>
            {t.updates.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className={styles.updatesSide}>
          <figure className={styles.updatesShot}>
            <Image src={media("beta6/header-update.webp")} width={1120} height={300} sizes="(max-width: 900px) 100vw, 45vw" alt={t.updatesAlt} />
          </figure>
          <div className={styles.keyCard}>
            <strong>{t.keyTitle}</strong>
            <code>HPDG-XXXX-XXXX-XXXX-XXXX</code>
            <p>{t.keyText}</p>
          </div>
        </div>
      </section>

      <section className={styles.reqSection}>
        <header className={styles.sectionHeader}>
          <span>WINDOWS / VST3</span>
          <h2>{t.reqTitle}</h2>
        </header>
        <ul className={styles.reqList}>
          {t.req.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className={styles.devlog} id="devlog">
        <header className={styles.sectionHeader}>
          <span>DEV LOG</span>
          <h2>{t.devlogTitle}</h2>
        </header>
        {latestEntry ? (
          <div className={styles.devlogLatest}>
            {latestEntry.showDate ? (
              <time className={styles.devlogDate}>{entryMeta(latestEntry)}</time>
            ) : (
              <h3 className={styles.releaseTitle}>{latestEntry.title}</h3>
            )}
            {latestEntry.content}
          </div>
        ) : null}
        {olderEntries.length ? (
          <div className={styles.devlogArchive}>
            <p className={styles.devlogArchiveLabel}>{t.devlogArchive}</p>
            {olderEntries.map((entry) => (
              <details key={entry.id} className={styles.devlogItem} id={entry.id === "beta2" ? "beta2" : undefined}>
                <summary>
                  <span>{entry.title}</span>
                  <time>{entryMeta(entry)}</time>
                </summary>
                <div className={styles.devlogBody}>{entry.content}</div>
              </details>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.supportSection} id="support">
        <div className={styles.supportIntro}>
          <p className={styles.eyebrow}>{t.buyEyebrow}</p>
          <h2>{t.buyTitle}</h2>
          <p>{t.buyText}</p>
        </div>
        <div className={styles.tierGrid}>
          <article className={styles.tierCard}>
            <Image src={media("item-01.webp")} width={696} height={464} sizes="(max-width: 700px) 100vw, 33vw" alt="" />
            <div className={styles.tierBody}>
              <p className={styles.tierPrice}>{PRICE}</p>
              <h3>HPDG {VERSION_LABEL}</h3>
              <p className={styles.tierDescription}>{t.tierDescription}</p>
              <ul>
                {t.tierIncludes.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <a className={styles.tierButton} href={buyHref} target="_blank" rel="noreferrer">
                {t.tierButton}<span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>
        <div className={styles.supportNote}>
          <strong>{t.howTitle}</strong>
          <p>{t.how}</p>
          <p>{t.honest}</p>
          <span>Windows 10/11 64-bit · VST3</span>
        </div>
      </section>

      <section className={styles.faq}>
        <header className={styles.sectionHeader}>
          <span>FAQ</span>
          <h2>{t.faqTitle}</h2>
        </header>
        <div className={styles.faqGrid}>
          {t.faq.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      {adminSession.isAuthenticated ? (
        <section className={styles.adminSection}>
          <p>{t.adminLabel}</p>
          <AdminPostCrudManager posts={adminPosts} />
        </section>
      ) : null}
    </div>
  );
}
