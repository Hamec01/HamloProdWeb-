import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DeveloperDiaryDialog } from "@/components/vst/developer-diary-dialog";
import { getAdminSessionState } from "@/lib/auth/session";
import { localizePosts } from "@/lib/localize-content";
import { normalizeLocale } from "@/lib/market";
import { getPosts } from "@/services/content";
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
  const [vstPosts, adminSession] = await Promise.all([getPosts("vst"), getAdminSessionState()]);
  const posts = await localizePosts(vstPosts, locale);

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
            <p className={styles.pluginType}>VST3 · WINDOWS 10/11 · 919 {isRu ? "СЕМПЛОВ" : "SAMPLES"}</p>
            <h2>HPDG <span className={styles.releaseBadge}>Beta 7</span></h2>
            <p>
              {isRu
                ? "Новая Beta 7: ATL Classic и Dark Trap, редактор HPDG 808 и анализ тональности Basic Pitch. Создай бит под свой луп и перенеси MIDI или WAV в DAW."
                : "New in Beta 7: ATL Classic and Dark Trap, the HPDG 808 editor and Basic Pitch key analysis. Build a beat around your loop and drag MIDI or WAV into your DAW."}
            </p>
            <span className={styles.pluginLink}>
              {isRu ? "Подробнее о плагине" : "Explore plugin"} <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>

        <article className={styles.comingSoon}>
          <span aria-hidden="true">+</span>
          <h2>{isRu ? "Скоро" : "Coming soon"}</h2>
          <p>{isRu ? "Здесь появятся новые плагины HamloProd." : "New HamloProd plugins will appear here."}</p>
        </article>
      </section>
    </div>
  );
}
