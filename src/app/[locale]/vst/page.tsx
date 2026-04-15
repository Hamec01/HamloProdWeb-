import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { normalizeLocale, sectorLabels } from "@/lib/market";

export default async function SectorVstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].vst}
        title={locale === "ru" ? "Drum Generator VST" : "Drum Generator VST"}
        description={locale === "ru" ? "Отдельный сектор инструмента. Продажи и документация будут подключены отдельно." : "Dedicated instrument sector. Sales and documentation will be connected separately."}
      />

      <article className="case-panel p-6">
        <p className="text-sm leading-7 text-[var(--color-paper-200)]">
          {locale === "ru"
            ? "Здесь будет отдельная витрина VST без смешивания с архивом битов, артистами и релизами."
            : "This area will host the VST storefront without mixing it with beats, artists, or releases."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]">
            {locale === "ru" ? "На главную" : "Back home"}
          </Link>
          <span className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)]">
            {locale === "ru" ? "Скоро" : "Coming Soon"}
          </span>
        </div>
      </article>
    </section>
  );
}
