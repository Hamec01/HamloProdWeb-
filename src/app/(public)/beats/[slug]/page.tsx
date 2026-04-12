import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BeatDownloadButton } from "@/components/beats/beat-download-button";
import { ContentFeedbackCard } from "@/components/feedback/content-feedback-card";
import { PlayBeatButton } from "@/components/beats/play-beat-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPublicSessionState } from "@/lib/auth/session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getBeatBySlug, getBeats } from "@/services/content";

function getLicenseRequestHref(beatTitle: string, beatSlug: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_LICENSE_REQUEST_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  const separator = configuredUrl.includes("?") ? "&" : "?";
  return `${configuredUrl}${separator}beat=${encodeURIComponent(beatSlug)}&title=${encodeURIComponent(beatTitle)}`;
}

export default async function BeatCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [beat, beats, session, locale] = await Promise.all([getBeatBySlug(slug), getBeats(), getPublicSessionState(), getLocale()]);
  const t = dictionary[locale];

  if (!beat) {
    notFound();
  }

  const licenseRequestHref = getLicenseRequestHref(beat.title, beat.slug);
  const hasSaleAssets = Boolean(beat.wavFilePath || beat.zipFilePath);

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
          <h1 className="mt-3 font-sans text-5xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] sm:text-6xl">
            {beat.title}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)]">
            {beat.mood} / {beat.bpm} BPM / {beat.duration}
          </p>

          {beat.coverImageUrl ? (
            <div
              className="case-artwork mt-6 h-[22rem]"
              style={{ backgroundImage: `url(${beat.coverImageUrl})` }}
            />
          ) : (
            <div className={`mt-6 h-[22rem] border border-[var(--color-line)] bg-gradient-to-br ${beat.coverPalette}`} />
          )}

          <p className="mt-6 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">{beat.description}</p>
        </article>

        <aside className="space-y-6">
          <section className="case-panel p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{t.playback}</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.previewStream}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">
              {locale === "ru"
                ? "Здесь пользователь слушает public preview. Бесплатный MP3 доступен зарегистрированным пользователям, а WAV/ZIP выдаются только после покупки."
                : "Users can stream a public preview here. Free MP3 is available for registered users, while WAV/ZIP are delivered after purchase."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PlayBeatButton beat={beat} queue={beats} locale={locale} />
            </div>
          </section>

          <section className="case-panel p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{t.purchase}</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{t.licenseAccess}</h2>
            <div className="mt-4 flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4">
              <span className="text-sm uppercase tracking-[0.18em] text-[var(--color-paper-400)]">{t.currentPrice}</span>
              <span className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">${beat.priceUsd}</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">
              {locale === "ru"
                ? "Сейчас это публичная карточка конкретного бита. Здесь можно скачать MP3 при наличии аккаунта, а выдачу WAV/ZIP подключить через checkout после покупки."
                : "This is a public beat card. Users can download MP3 with an account, while WAV/ZIP delivery is handled through checkout after purchase."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BeatDownloadButton
                beatId={beat.id}
                beatSlug={beat.slug}
                isAuthenticated={session.isAuthenticated}
                availableForDownload={beat.availableForDownload}
                locale={locale}
              />
              {licenseRequestHref ? (
                <Link
                  href={licenseRequestHref}
                  className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)]"
                >
                  {t.buyLicense}
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
                  {hasSaleAssets ? t.buyLicenseSoon : t.saleAssetsNotReady}
                </span>
              )}
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                {session.isAuthenticated ? t.buyerAccount : t.buyerLogin}
                <ArrowRight size={14} />
              </Link>
            </div>
            {!licenseRequestHref ? (
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)]">
                {locale === "ru"
                  ? "Добавь NEXT_PUBLIC_LICENSE_REQUEST_URL в Vercel, чтобы кнопка покупки вела на checkout или форму заказа."
                  : "Add NEXT_PUBLIC_LICENSE_REQUEST_URL in Vercel so the purchase button points to checkout or a request form."}
              </p>
            ) : null}

            <ContentFeedbackCard entity="beats" contentId={beat.id} isAuthenticated={session.isAuthenticated} locale={locale} />
          </section>
        </aside>
      </div>
    </section>
  );
}