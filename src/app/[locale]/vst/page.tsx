import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DeveloperDiaryDialog } from "@/components/vst/developer-diary-dialog";
import { getAdminSessionState } from "@/lib/auth/session";
import { getDiaryPosts } from "@/lib/diary/posts";
import { normalizeLocale } from "@/lib/market";
import styles from "./page.module.css";

const MEDIA = `${(
  process.env.S3_PUBLIC_BASE_URL?.trim() ||
  "https://usc1.contabostorage.com/e83fedb37f3543d0bc6c23caf78439e5:hamloprod-public"
).replace(/\/+$/, "")}/hpdg/site`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const isRu = locale === "ru";

  return {
    title: isRu ? "VST-плагины | HamloProd" : "VST Plugins | HamloProd",
    description: isRu ? "Плагины HamloProd для создания музыки." : "Music production plugins by HamloProd.",
    alternates: {
      canonical: `https://hamloprod.org/${locale}/vst`,
      languages: {
        en: "https://hamloprod.org/en/vst",
        ru: "https://hamloprod.org/ru/vst",
      },
    },
  };
}

export default async function VstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const isRu = locale === "ru";
  const adminSession = await getAdminSessionState();
  const posts = await getDiaryPosts(locale, adminSession.isAuthenticated);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>HAMLOPROD / PLUGINS</p>
          <h1>VST</h1>
          <p className={styles.intro}>
            {isRu
              ? "Плагины для создания музыки. Выбери инструмент, чтобы узнать о нём больше."
              : "Tools for making music. Choose a plugin to learn more."}
          </p>
        </div>
        <DeveloperDiaryDialog posts={posts} locale={locale} isAdmin={adminSession.isAuthenticated} />
      </header>

      <section className={styles.pluginGrid} aria-label={isRu ? "Список плагинов" : "Plugin list"}>
        <Link className={styles.pluginCard} href={`/${locale}/vst/hpdg`}>
          <div className={styles.pluginImage}>
            <Image src={`${MEDIA}/logo-white.webp`} width={850} height={1024} alt="HPDG" />
          </div>
          <div className={styles.pluginInfo}>
            <p className={styles.pluginType}>VST3 · WINDOWS 10/11 · 1147 {isRu ? "СЕМПЛОВ" : "SAMPLES"}</p>
            <h2>HPDG <span className={styles.releaseBadge}>Beta 8</span></h2>
            <p>
              {isRu
                ? "Новая Beta 8: перестроенный Boom Bap Underground, влияние семпла 1/2/3, Copy + Sample Tempo и Export Full MIDI как drum map."
                : "New in Beta 8: rebuilt Boom Bap Underground, Sample influence 1/2/3, Copy + Sample Tempo and Export Full MIDI as a drum map."}
            </p>
            <span className={styles.pluginLink}>
              {isRu ? "Подробнее о плагине" : "Explore plugin"} <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>

        <Link className={styles.pluginCard} href={`/${locale}/vst/hpdg808`}>
          <div className={`${styles.pluginImage} ${styles.bassImage}`}>
            <Image src="/hpdg808/images/hpdg808_synth.png" width={1000} height={650} sizes="(max-width: 700px) 100vw, 50vw" alt={isRu ? "Интерфейс басового инструмента HPDG 808" : "HPDG 808 bass instrument interface"} />
          </div>
          <div className={styles.pluginInfo}>
            <p className={styles.pluginType}>VST3 + STANDALONE · WINDOWS 10/11 x64</p>
            <h2>HPDG 808 <span className={styles.freeBadge}>{isRu ? "Бесплатно" : "Free"}</span></h2>
            <p>{isRu
              ? "808-синтезатор, семплер и мастер-секция для баса. 200 пресетов, экспорт WAV и бесплатное скачивание. Чаевые — по желанию =)"
              : "An 808 synth, sample layer and bass mastering. 200 presets, WAV export and a free download. Tips welcome =)"}</p>
            <span className={styles.pluginLink}>
              {isRu ? "Подробнее о плагине" : "Explore plugin"} <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
