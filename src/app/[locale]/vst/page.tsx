import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDown,
  Check,
  Coffee,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Grid3X3,
  Headphones,
  Layers3,
  Music2,
  PackageCheck,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  Waves,
} from "lucide-react";
import { normalizeLocale } from "@/lib/market";

const RELEASE_BASE =
  "https://usc1.contabostorage.com/e83fedb37f3543d0bc6c23caf78439e5:hamloprod-public/hpdg/releases/f47ee27f7421198000";
const RELEASE_URL = `${RELEASE_BASE}/HPDGRelease.zip`;
const GUIDE_URL = `${RELEASE_BASE}/HPDG_Field_Guide.html`;
const FAQ_URL = `${RELEASE_BASE}/FAQ.md`;
const LOGO_URL = `${RELEASE_BASE}/Logo_black.png`;
const CONTROLS_IMAGE = `${RELEASE_BASE}/HPDG_controls.png`;
const RACK_IMAGE = `${RELEASE_BASE}/HPDG_rack_grid.png`;
const RELEASE_SHA256 = "f47ee27f7421198000fb3b1a15a33fe95160fadcfb1b67e83c03bcda22295cfe";
const TIP_URL = process.env.DRUM_GENERATOR_TIP_URL?.trim();

const copy = {
  ru: {
    eyebrow: "HamloProd Drum Generator · VST3 / Standalone",
    status: "Актуальный Windows-релиз",
    title: "Собери groove.",
    titleAccent: "Не считай клетки.",
    intro:
      "HPDG создаёт полноценные барабанные паттерны из жанра и характера ритма. Это настоящий MIDI — его можно редактировать, мутировать и перетащить прямо в DAW.",
    download: "Скачать бесплатно",
    tip: "На чай!",
    free: "Бесплатно · без подписки",
    release: "HPDGRelease.zip · 58 MB",
    platform: "Windows 10+ · 64-bit",
    included: "VST3 + Standalone + Factory Kits",
    scroll: "Посмотреть возможности",
    manifestoTitle: "Идея сначала. Детали потом.",
    manifestoText:
      "Выбери жанр и подстиль, задай Swing, Density и длину — HPDG построит kick, snare, hats, ghost-слои и текстуры как связный рисунок, а не случайный набор ударов.",
    genresLabel: "Доступно в этом релизе",
    genres: ["Boom Bap", "Trap"],
    future: "Rap и Drill уже есть в движке и вернутся после дополнительной настройки.",
    featuresTitle: "От первой идеи до трека",
    featuresIntro:
      "Генератор ускоряет черновик, но не забирает контроль: каждый слой можно пересобрать, отредактировать и вывести отдельно.",
    features: [
      ["Жанровые движки", "Boom Bap и Trap с собственными substyle-профилями, pocket, swing и density.", "wand"],
      ["Generate + Mutate", "Generate пишет новый паттерн, Mutate меняет fills и accents, сохраняя найденную форму.", "refresh"],
      ["Редактируемый Grid", "Добавляй, удаляй и перемещай hits вручную. Snap меняет разрешение сетки.", "grid"],
      ["Instrument Rack", "Kick, snare, hats, ghost lanes, texture и Sub808 — с Solo, Mute, Clear и per-lane RG.", "layers"],
      ["MIDI и WAV", "Drag Full или отдельный Drag для lane; Export Full и Export Loop WAV сохраняют файлы на диск.", "music"],
      ["Свои сэмплы", "Factory kits уже внутри, но каждый lane можно направить на собственные one-shots.", "sliders"],
      ["Style Lab", "Загрузи референс, чтобы перенести placement, density и feel kick/hi-hat в будущие генерации.", "waves"],
      ["Точный Seed", "Одинаковые Genre, Substyle, Swing, Density и Seed всегда дают тот же самый паттерн.", "gauge"],
    ],
    guideEyebrow: "Field Guide · интерфейс",
    guideTitle: "Весь ритм в одном окне",
    guideText:
      "Верхняя панель отвечает за генерацию, tempo, transport и export. Ниже — instrument rack и step grid, где каждый lane остаётся доступен отдельно.",
    guideButton: "Открыть полный Field Guide",
    rackTitle: "Lane за lane",
    rackText:
      "Regenerate, Solo, Mute, Clear, выбор сэмпла, level/pitch и отдельный MIDI drag повторяются на каждой дорожке. + Lane добавляет новый инструмент.",
    workflowTitle: "Пять движений — и паттерн в DAW",
    workflow: [
      ["01", "Выбери Genre и Substyle", "Boom Bap / Classic — стартовая точка; каждый substyle уже несёт собственный feel."],
      ["02", "Настрой Bars и Tempo", "Выбери длину секции. Sync следует темпу DAW, Lock фиксирует BPM HPDG."],
      ["03", "Нажми Generate", "Swing и Density применяются сразу. Seed позволяет точно повторить результат."],
      ["04", "Прослушай и уточни", "Play — превью, Mutate — вариация, per-lane RG — новый рисунок одного инструмента."],
      ["05", "Перетащи MIDI", "Drag Full отправляет весь паттерн на track; lane Drag — только выбранный инструмент."],
    ],
    installTitle: "Что устанавливается",
    installItems: [
      "VST3 в общей папке Common Files\\VST3",
      "Standalone-приложение в Program Files\\HPDG",
      "Factory kits — отдельные sample packs не нужны",
      "Пользовательские patterns, exports и Style Lab captures остаются в Documents",
    ],
    requirements: "Нужны Windows 10 или новее и 64-bit система. Для VST3 — совместимая DAW; Standalone работает без host.",
    compatibilityTitle: "Работает там, где ты работаешь",
    compatibilityText:
      "FL Studio, Ableton Live, Reaper, Cubase, Studio One и другие VST3-hosts. В FL Studio HPDG использует компактный header-only layout, чтобы обходить известную проблему сканирования — все функции генерации остаются доступны.",
    faqTitle: "Частые вопросы",
    faqs: [
      ["Это sample player или MIDI generator?", "И то и другое. HPDG назначает сэмплы для preview и audio print, но сам паттерн — MIDI. Built-in sounds можно отключить и использовать свой drum rack."],
      ["Можно редактировать паттерн вручную?", "Да. Grid — обычный step editor: кликай hits, перемещай их и меняй Snap. Per-lane RG не затрагивает ручные правки на других lanes."],
      ["Почему первая генерация иногда дольше?", "При первом Generate для нового substyle HPDG читает сохранённые reference data. После этого данные кэшируются, и следующие генерации становятся быстрыми."],
      ["Почему тот же набор настроек дал другой рисунок?", "Без фиксированного Seed генерация намеренно создаёт новую вариацию. Укажи Seed, если нужен точно воспроизводимый результат."],
      ["DAW не видит плагин — что делать?", "Закрой и снова открой DAW, затем запусти rescan в plugin manager. Убедись, что используется 64-bit host. Standalone поможет проверить саму установку."],
    ],
    fullFaq: "Открыть полный FAQ",
    integrityTitle: "Проверенный релиз",
    integrityText: "Архив загружен напрямую из предоставленного Release.zip и проверен после загрузки.",
    sha: "SHA-256",
    finalTitle: "Поймай ритм. Дальше — твой ход.",
    finalText:
      "Скачивание всегда бесплатное. Если HPDG помог быстрее дойти до музыки, можешь поддержать дальнейшую разработку добровольными чаевыми.",
    supportTitle: "Поддержать HPDG",
    supportText: "Чаевые не открывают функции и не влияют на загрузку — это просто способ сказать спасибо BoomBap Labs.",
    supportPending: "Платёжная ссылка пока не подключена",
    back: "Вернуться на главную",
  },
  en: {
    eyebrow: "HamloProd Drum Generator · VST3 / Standalone",
    status: "Current Windows release",
    title: "Build the groove.",
    titleAccent: "Skip the grid counting.",
    intro:
      "HPDG creates complete drum patterns from a genre and a feel. The result is real MIDI you can edit, mutate, and drag straight into your DAW.",
    download: "Download free",
    tip: "Leave a tip!",
    free: "Free · no subscription",
    release: "HPDGRelease.zip · 58 MB",
    platform: "Windows 10+ · 64-bit",
    included: "VST3 + Standalone + Factory Kits",
    scroll: "Explore the release",
    manifestoTitle: "Idea first. Details second.",
    manifestoText:
      "Pick a genre and substyle, set Swing, Density, and length — HPDG builds kick, snare, hats, ghost layers, and textures as one coherent rhythm instead of random hits.",
    genresLabel: "Available in this release",
    genres: ["Boom Bap", "Trap"],
    future: "Rap and Drill already exist in the engine and will return after more tuning.",
    featuresTitle: "From first idea to the track",
    featuresIntro:
      "The generator speeds up the first draft without taking away control: every layer can be rebuilt, edited, and exported separately.",
    features: [
      ["Genre engines", "Boom Bap and Trap with their own substyle profiles, pocket, swing, and density.", "wand"],
      ["Generate + Mutate", "Generate writes a new pattern; Mutate changes fills and accents while preserving its shape.", "refresh"],
      ["Editable Grid", "Add, remove, and move hits by hand. Snap changes the editing resolution.", "grid"],
      ["Instrument Rack", "Kick, snare, hats, ghost lanes, texture, and Sub808 — with Solo, Mute, Clear, and per-lane RG.", "layers"],
      ["MIDI and WAV", "Drag Full or drag one lane; Export Full and Export Loop WAV write files to disk.", "music"],
      ["Your own samples", "Factory kits are included, but every lane can point at your own one-shots.", "sliders"],
      ["Style Lab", "Feed it a reference to carry placement, density, and kick/hi-hat feel into future generations.", "waves"],
      ["Exact Seed", "The same Genre, Substyle, Swing, Density, and Seed always reproduce the same pattern.", "gauge"],
    ],
    guideEyebrow: "Field Guide · interface",
    guideTitle: "The whole rhythm in one window",
    guideText:
      "The top bar handles generation, tempo, transport, and export. Below it, the instrument rack and step grid keep every lane within reach.",
    guideButton: "Open the full Field Guide",
    rackTitle: "Lane by lane",
    rackText:
      "Regenerate, Solo, Mute, Clear, sample selection, level/pitch, and individual MIDI drag repeat on every track. + Lane adds another instrument.",
    workflowTitle: "Five moves from blank session to MIDI",
    workflow: [
      ["01", "Choose Genre and Substyle", "Boom Bap / Classic is the starting point; every substyle carries its own feel."],
      ["02", "Set Bars and Tempo", "Choose the section length. Sync follows the DAW; Lock keeps HPDG at a fixed BPM."],
      ["03", "Hit Generate", "Swing and Density apply immediately. A fixed Seed makes the result reproducible."],
      ["04", "Audition and refine", "Play previews, Mutate varies the idea, and per-lane RG rebuilds one instrument."],
      ["05", "Drag the MIDI", "Drag Full sends the pattern to a track; lane Drag exports only the chosen instrument."],
    ],
    installTitle: "What gets installed",
    installItems: [
      "VST3 in the shared Common Files\\VST3 folder",
      "Standalone app in Program Files\\HPDG",
      "Factory kits — no separate sample packs required",
      "Your patterns, exports, and Style Lab captures stay in Documents",
    ],
    requirements: "Requires Windows 10 or later and a 64-bit system. VST3 needs a compatible DAW; Standalone works without a host.",
    compatibilityTitle: "Works where you work",
    compatibilityText:
      "FL Studio, Ableton Live, Reaper, Cubase, Studio One, and other VST3 hosts. In FL Studio, HPDG uses a compact header-only layout to avoid a known scan issue — every generation feature remains available.",
    faqTitle: "Frequently asked",
    faqs: [
      ["Is this a sample player or a MIDI generator?", "Both. HPDG assigns sounds for preview and audio printing, but the pattern itself is MIDI. Mute the built-in sounds and use your own drum rack whenever you want."],
      ["Can I edit a pattern by hand?", "Yes. The Grid is a regular step editor: click hits, move them, and change Snap. Per-lane RG leaves edits on every other lane untouched."],
      ["Why is the first generation sometimes slower?", "The first Generate on a new substyle reads its saved reference data. HPDG caches it immediately, so the following generations are fast."],
      ["Why did the same settings create a different rhythm?", "Without a fixed Seed, Generate intentionally creates a fresh variation. Set a Seed when you need exact repeatability."],
      ["My DAW cannot see the plugin — what now?", "Close and reopen the DAW, then run a rescan in its plugin manager. Confirm the host is 64-bit. The Standalone app can verify the installation itself."],
    ],
    fullFaq: "Open the full FAQ",
    integrityTitle: "Verified release",
    integrityText: "The archive came directly from the supplied Release.zip and was verified after upload.",
    sha: "SHA-256",
    finalTitle: "Catch the rhythm. Take it from here.",
    finalText:
      "The download is always free. If HPDG gets you to the music faster, you can support continued development with an optional tip.",
    supportTitle: "Support HPDG",
    supportText: "Tips do not unlock features or affect the download — they are simply a way to thank BoomBap Labs.",
    supportPending: "The payment link is not connected yet",
    back: "Back to home",
  },
} as const;

const icons = {
  wand: WandSparkles,
  refresh: RefreshCw,
  grid: Grid3X3,
  layers: Layers3,
  music: Music2,
  sliders: SlidersHorizontal,
  waves: Waves,
  gauge: Gauge,
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return {
    title: locale === "ru" ? "HPDG — бесплатный Drum Generator VST3" : "HPDG — Free Drum Generator VST3",
    description:
      locale === "ru"
        ? "Бесплатный VST3 и Standalone генератор барабанных MIDI-паттернов для Windows."
        : "A free VST3 and Standalone MIDI drum pattern generator for Windows.",
    openGraph: {
      title: "HPDG · HamloProd Drum Generator",
      description:
        locale === "ru"
          ? "Создавай groove и перетаскивай готовый MIDI прямо в DAW."
          : "Build a groove and drag the finished MIDI straight into your DAW.",
      images: [RACK_IMAGE],
      type: "website",
    },
  };
}

function ActionLink({
  href,
  children,
  kind = "primary",
  newTab = false,
}: {
  href: string;
  children: ReactNode;
  kind?: "primary" | "tip" | "quiet";
  newTab?: boolean;
}) {
  const classes = {
    primary: "border-[#d9ae68] bg-[#e7c07f] text-[#17120b] hover:bg-[#f2d49f]",
    tip: "border-[#d9ae68]/50 bg-[#d9ae68]/10 text-[#ead0a1] hover:bg-[#d9ae68]/20",
    quiet: "border-white/15 bg-white/[0.025] text-[var(--color-paper-200)] hover:bg-white/[0.07]",
  }[kind];

  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 border px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${classes}`}
    >
      {children}
    </a>
  );
}

export default async function SectorVstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = copy[locale];

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HPDG — HamloProd Drum Generator",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Windows 10 or later, 64-bit",
    description: t.intro,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <section className="hpdg-page -mx-2 space-y-24 overflow-hidden pb-8 sm:-mx-4 lg:space-y-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />

      <section className="hpdg-hero relative isolate min-h-[720px] overflow-hidden border border-[#dfb66f]/20 bg-[#070604]">
        <div className="hpdg-grid absolute inset-0 opacity-45" />
        <div className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[#d3a456]/[0.08] blur-[120px]" />
        <img
          src={LOGO_URL}
          alt=""
          aria-hidden="true"
          className="absolute -right-10 top-8 h-[610px] w-auto rotate-6 object-contain opacity-[0.055] invert"
        />

        <div className="relative z-10 flex min-h-[720px] flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
          <div className="mb-8 inline-flex w-fit items-center gap-2 border border-[#d9ae68]/35 bg-black/50 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-[#e0bd82]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e6bb74]" />
            {t.status}
          </div>
          <p className="text-xs uppercase tracking-[0.34em] text-[var(--color-paper-400)]">{t.eyebrow}</p>
          <h1 className="mt-5 max-w-5xl font-sans text-[clamp(4.8rem,12vw,9.8rem)] uppercase leading-[0.78] tracking-[0.01em] text-[var(--color-paper-100)]">
            {t.title}
            <span className="mt-3 block text-[#dfb36c]">{t.titleAccent}</span>
          </h1>
          <p className="mt-8 max-w-2xl text-sm leading-7 text-[var(--color-paper-200)] sm:text-base sm:leading-8">{t.intro}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ActionLink href={RELEASE_URL}>
              <Download className="h-4 w-4" />
              {t.download}
            </ActionLink>
            <ActionLink href={TIP_URL || "#support"} kind="tip" newTab={Boolean(TIP_URL)}>
              <Coffee className="h-4 w-4" />
              {t.tip}
            </ActionLink>
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{t.free}</p>

          <div className="mt-12 grid max-w-4xl gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
            {[t.release, t.platform, t.included].map((item) => (
              <div key={item} className="bg-black/65 px-4 py-4 text-[10px] uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
                <Check className="mr-2 inline h-3.5 w-3.5 text-[#d9ae68]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <a href="#features" className="absolute bottom-7 right-7 z-20 hidden items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)] hover:text-white sm:flex">
          {t.scroll} <ArrowDown className="h-4 w-4" />
        </a>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <h2 className="font-sans text-6xl uppercase leading-[0.9] tracking-[0.03em] text-[var(--color-paper-100)] sm:text-7xl">{t.manifestoTitle}</h2>
        <div className="border-l border-[#d9ae68]/40 pl-6">
          <p className="text-sm leading-7 text-[var(--color-paper-200)]">{t.manifestoText}</p>
          <p className="mt-7 text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.genresLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.genres.map((genre) => (
              <span key={genre} className="border border-[#d9ae68]/30 bg-[#d9ae68]/[0.07] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#e6c994]">{genre}</span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-[var(--color-paper-400)]">{t.future}</p>
        </div>
      </section>

      <section id="features" className="scroll-mt-12 px-4">
        <div className="mb-10 grid gap-5 lg:grid-cols-2 lg:items-end">
          <h2 className="font-sans text-5xl uppercase tracking-[0.04em] text-[var(--color-paper-100)] sm:text-6xl">{t.featuresTitle}</h2>
          <p className="max-w-xl text-sm leading-7 text-[var(--color-paper-200)] lg:justify-self-end">{t.featuresIntro}</p>
        </div>
        <div className="grid border-l border-t border-white/10 md:grid-cols-2 lg:grid-cols-4">
          {t.features.map(([title, text, icon], index) => {
            const Icon = icons[icon];
            return (
              <article key={title} className="group min-h-64 border-b border-r border-white/10 bg-black/55 p-6 transition-colors hover:bg-[#d9ae68]/[0.055]">
                <div className="flex items-start justify-between">
                  <Icon className="h-6 w-6 text-[#d0a15a]" strokeWidth={1.4} />
                  <span className="font-sans text-4xl text-white/[0.08]">0{index + 1}</span>
                </div>
                <h3 className="mt-9 font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-paper-400)] group-hover:text-[var(--color-paper-200)]">{text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-16 px-4">
        <div className="grid gap-7 lg:grid-cols-[0.34fr_0.66fr] lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#c7954d]">{t.guideEyebrow}</p>
            <h2 className="mt-4 font-sans text-5xl uppercase leading-none tracking-[0.04em] text-[var(--color-paper-100)]">{t.guideTitle}</h2>
            <p className="mt-5 text-sm leading-7 text-[var(--color-paper-400)]">{t.guideText}</p>
            <div className="mt-7">
              <ActionLink href={GUIDE_URL} kind="quiet" newTab>
                <FileText className="h-4 w-4" /> {t.guideButton} <ExternalLink className="h-3.5 w-3.5" />
              </ActionLink>
            </div>
          </div>
          <figure className="hpdg-screen overflow-hidden bg-[#eae4d7] p-2">
            <img src={CONTROLS_IMAGE} alt="HPDG transport and pattern controls" className="h-auto w-full" loading="lazy" />
          </figure>
        </div>

        <div className="grid gap-7 lg:grid-cols-[0.68fr_0.32fr] lg:items-center">
          <figure className="hpdg-screen overflow-hidden bg-[#eae4d7] p-2">
            <img src={RACK_IMAGE} alt="HPDG instrument rack and editable pattern grid" className="h-auto w-full" loading="lazy" />
          </figure>
          <div className="lg:pl-5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#c7954d]">02 · Instrument Rack & Grid</p>
            <h2 className="mt-4 font-sans text-5xl uppercase leading-none tracking-[0.04em] text-[var(--color-paper-100)]">{t.rackTitle}</h2>
            <p className="mt-5 text-sm leading-7 text-[var(--color-paper-400)]">{t.rackText}</p>
          </div>
        </div>
      </section>

      <section className="px-4">
        <h2 className="max-w-4xl font-sans text-5xl uppercase tracking-[0.04em] text-[var(--color-paper-100)] sm:text-6xl">{t.workflowTitle}</h2>
        <div className="mt-10 grid gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-5">
          {t.workflow.map(([number, title, text]) => (
            <article key={number} className="min-h-72 bg-[#050505] p-6">
              <span className="font-sans text-6xl text-[#d6a45b]">{number}</span>
              <h3 className="mt-7 font-sans text-2xl uppercase tracking-[0.07em] text-[var(--color-paper-100)]">{title}</h3>
              <p className="mt-3 text-xs leading-6 text-[var(--color-paper-400)]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 px-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="case-panel p-7 sm:p-9">
          <PackageCheck className="h-6 w-6 text-[#d2a35b]" />
          <h2 className="mt-5 font-sans text-5xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.installTitle}</h2>
          <ul className="mt-8 space-y-4">
            {t.installItems.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-7 text-[var(--color-paper-200)]">
                <Check className="mt-1.5 h-4 w-4 shrink-0 text-[#d2a35b]" /> {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-[var(--color-paper-400)]">{t.requirements}</p>
        </article>
        <article className="border border-[#d9ae68]/20 bg-[linear-gradient(145deg,rgba(217,174,104,0.08),rgba(5,5,5,0.98)_58%)] p-7 sm:p-9">
          <Headphones className="h-6 w-6 text-[#d2a35b]" />
          <h2 className="mt-5 font-sans text-5xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.compatibilityTitle}</h2>
          <p className="mt-6 text-sm leading-7 text-[var(--color-paper-200)]">{t.compatibilityText}</p>
        </article>
      </section>

      <section className="px-4">
        <div className="grid gap-8 lg:grid-cols-[0.36fr_0.64fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#c7954d]">FAQ / Support</p>
            <h2 className="mt-4 font-sans text-6xl uppercase tracking-[0.04em] text-[var(--color-paper-100)]">{t.faqTitle}</h2>
            <div className="mt-7">
              <ActionLink href={FAQ_URL} kind="quiet" newTab>
                <FileText className="h-4 w-4" /> {t.fullFaq} <ExternalLink className="h-3.5 w-3.5" />
              </ActionLink>
            </div>
          </div>
          <div className="border-t border-white/10">
            {t.faqs.map(([question, answer]) => (
              <details key={question} className="group border-b border-white/10 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium text-[var(--color-paper-100)]">
                  {question}
                  <span className="text-2xl font-light text-[#d2a35b] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-3xl pt-4 text-sm leading-7 text-[var(--color-paper-400)]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4">
        <div className="case-panel grid gap-6 p-7 sm:p-9 lg:grid-cols-[0.4fr_0.6fr] lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#c7954d]">Release integrity</p>
            <h2 className="mt-4 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.integrityTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-paper-400)]">{t.integrityText}</p>
          </div>
          <div className="min-w-0 border border-white/10 bg-black/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-paper-400)]">{t.sha}</p>
            <code className="mt-2 block overflow-x-auto text-xs text-[#e0bd82]">{RELEASE_SHA256}</code>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-[#d9ae68]/25 bg-[linear-gradient(110deg,#100b05,#030303_60%)] px-6 py-16 sm:px-12 sm:py-20">
        <div className="hpdg-grid absolute inset-0 opacity-25" />
        <Music2 className="absolute -bottom-14 -right-8 h-72 w-72 text-white/[0.025]" strokeWidth={0.6} />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#c7954d]">HPDG · BoomBap Labs</p>
          <h2 className="mt-5 font-sans text-6xl uppercase leading-[0.9] tracking-[0.03em] text-[var(--color-paper-100)] sm:text-8xl">{t.finalTitle}</h2>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--color-paper-200)]">{t.finalText}</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href={RELEASE_URL}><Download className="h-4 w-4" /> {t.download}</ActionLink>
            <ActionLink href={TIP_URL || "#support"} kind="tip" newTab={Boolean(TIP_URL)}><Coffee className="h-4 w-4" /> {t.tip}</ActionLink>
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--color-paper-400)]">{t.free}</p>
        </div>
      </section>

      <section id="support" className="scroll-mt-12 px-4">
        <div className="case-panel mx-auto max-w-3xl p-7 text-center sm:p-10">
          <Coffee className="mx-auto h-7 w-7 text-[#d2a35b]" />
          <h2 className="mt-5 font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">{t.supportTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--color-paper-200)]">{t.supportText}</p>
          <div className="mt-7 flex justify-center">
            {TIP_URL ? (
              <ActionLink href={TIP_URL} kind="tip" newTab><Coffee className="h-4 w-4" /> {t.tip} <ExternalLink className="h-3.5 w-3.5" /></ActionLink>
            ) : (
              <span className="border border-white/10 px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{t.supportPending}</span>
            )}
          </div>
        </div>
      </section>

      <div className="px-4 text-center">
        <Link href={`/${locale}`} className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)] transition-colors hover:text-white">{t.back}</Link>
      </div>
    </section>
  );
}
