import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BeatDownloadButton } from "@/components/beats/beat-download-button";
import { PlayBeatButton } from "@/components/beats/play-beat-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPublicSessionState } from "@/lib/auth/session";
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
  const [beat, beats, session] = await Promise.all([getBeatBySlug(slug), getBeats(), getPublicSessionState()]);

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
          Back To Archive
        </Link>
        <StatusBadge status={beat.status} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="case-panel overflow-hidden p-6">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">Case File / {beat.caseNumber}</p>
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
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">Playback</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">Preview Stream</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">
              Здесь пользователь слушает public preview. Полный WAV и ZIP остаются закрытыми sale-asset файлами.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PlayBeatButton beat={beat} queue={beats} />
            </div>
          </section>

          <section className="case-panel p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">Purchase</p>
            <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">License Access</h2>
            <div className="mt-4 flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4">
              <span className="text-sm uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Current Price</span>
              <span className="font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">${beat.priceUsd}</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--color-paper-200)]">
              Сейчас это публичная карточка конкретного бита. Следующим шагом сюда можно подключить checkout и выдачу WAV/ZIP после покупки.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <BeatDownloadButton
                beatId={beat.id}
                beatSlug={beat.slug}
                isAuthenticated={session.isAuthenticated}
                hasDownloadFiles={Boolean(beat.wavFilePath || beat.zipFilePath)}
                availableForDownload={beat.availableForDownload}
              />
              {licenseRequestHref ? (
                <Link
                  href={licenseRequestHref}
                  className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)]"
                >
                  Buy License
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
                  {hasSaleAssets ? "Buy License Soon" : "Sale Assets Not Ready"}
                </span>
              )}
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                {session.isAuthenticated ? "Buyer Account" : "Buyer Login"}
                <ArrowRight size={14} />
              </Link>
            </div>
            {!licenseRequestHref ? (
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)]">
                Добавь `NEXT_PUBLIC_LICENSE_REQUEST_URL` в Vercel, чтобы кнопка покупки вела на checkout или форму заказа.
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}