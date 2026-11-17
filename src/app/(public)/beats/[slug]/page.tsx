import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BeatDownloadButton } from "@/components/beats/beat-download-button";
import { ContentFeedbackCard } from "@/components/feedback/content-feedback-card";
import { PlayBeatButton } from "@/components/beats/play-beat-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { localizeBeats } from "@/lib/localize-content";
import { formatMarketMoney, getBeatPriceForLocale, getMarketContext } from "@/lib/market";
import { getBeatBySlug, getBeats } from "@/services/content";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hamloprod.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [locale, rawBeat] = await Promise.all([getLocale(), getBeatBySlug(slug)]);

  if (!rawBeat) {
    return {
      title: "Beat not found | HamloProd",
      description: "Beat page",
    };
  }

  const [beat] = await localizeBeats([rawBeat], locale);

  const pageUrl = `${siteUrl}/beats/${beat.slug}`;
  const imageUrl = beat.coverImageUrl ?? undefined;
  const title = `${beat.title} | HamloProd`;
  const description = `${beat.genre.toUpperCase()} / ${beat.substyle} / ${beat.mood} / ${beat.bpm} BPM`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: "HamloProd",
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: beat.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function BeatCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, rawBeat, rawBeats, session] = await Promise.all([getLocale(), getBeatBySlug(slug), getBeats(), getPublicSessionState()]);
  const t = dictionary[locale];

  if (!rawBeat) {
    notFound();
  }

  const [[beat], beats] = await Promise.all([localizeBeats([rawBeat], locale), localizeBeats(rawBeats, locale)]);

  const market = getMarketContext(locale);
  const beatPrice = getBeatPriceForLocale(beat, locale);
  const priceLabel = formatMarketMoney(beatPrice, market.currency, locale);
  const buyLicenseHref = `/checkout/${beat.slug}`;

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/beats"
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {t.backToArchive}
        </Link>
        <StatusBadge status={beat.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="case-panel overflow-hidden p-6">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{t.caseFile} / {beat.caseNumber}</p>
          <h1 className="mt-3 font-sans text-5xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] sm:text-6xl">{beat.title}</h1>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)]">{beat.mood} / {beat.bpm} BPM / {beat.duration}</p>

          {beat.coverImageUrl ? (
            <div className="case-artwork mt-6 h-80" style={{ backgroundImage: `url(${beat.coverImageUrl})` }} />
          ) : (
            <div className={`mt-6 h-80 border border-[var(--color-line)] bg-gradient-to-br ${beat.coverPalette}`} />
          )}

          <p className="mt-6 text-base leading-8 text-[var(--color-paper-200)]">{beat.description}</p>
        </article>

        <aside className="space-y-6">
          <section className="case-panel p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{t.playback}</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.previewStream}</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <PlayBeatButton beat={beat} queue={beats} locale={locale} />
              <BeatDownloadButton
                beatId={beat.id}
                beatSlug={beat.slug}
                isAuthenticated={session.isAuthenticated}
                availableForDownload={beat.availableForDownload}
                locale={locale}
              />
            </div>
          </section>

          <section className="case-panel p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{t.purchase}</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.licenseAccess}</h2>
            <div className="mt-4 flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4">
              <span className="text-sm uppercase tracking-[0.18em] text-[var(--color-paper-400)]">{t.currentPrice}</span>
              <span className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">{priceLabel}</span>
            </div>
            {beat.status !== "sold" && beat.status !== "private" ? <Link href={buyLicenseHref} className="mt-5 inline-block border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.12em]">
              {locale === "ru" ? "Заполнить данные для лицензии" : "Fill License Details"}
            </Link> : null}
            {locale === "ru" || !process.env.STRIPE_SECRET_KEY?.trim() ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://t.me/Andrei91S"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)]"
                >
                  {locale === "ru" ? "Написать в Telegram" : "Buy via Telegram"}
                  <ArrowRight size={14} />
                </a>
                <a
                  href="https://vk.ru/hamloproduction"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  {locale === "ru" ? "Написать в VK" : "Buy via VK"}
                  <ArrowRight size={14} />
                </a>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={buyLicenseHref}
                  className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)]"
                >
                  {t.buyLicense}
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>

          <ContentFeedbackCard entity="beats" contentId={beat.id} isAuthenticated={session.isAuthenticated} locale={locale} />
        </aside>
      </div>
    </section>
  );
}