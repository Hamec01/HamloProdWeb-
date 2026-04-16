import { LanguageGateway } from "@/components/landing/language-gateway";
import { SplitSectorLogo } from "@/components/landing/split-sector-logo";
import { getLocale } from "@/lib/i18n-server";

export default async function HomePage() {
  const locale = await getLocale();

  return (
    <>
      <LanguageGateway locale={locale} />

      <section className="space-y-8 pt-6 text-center sm:pt-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.36em] text-[var(--color-paper-400)]">HamloProd</p>
          <h1 className="font-sans text-5xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] sm:text-7xl">
            {locale === "ru" ? "Выберите раздел" : "Choose Your Sector"}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-[var(--color-paper-200)]">
            {locale === "ru"
              ? "Архив битов, VST, HaM Hamilio и артисты — раздельно и без лишнего хаоса."
              : "Beats Archive, VST, HaM Hamilio, and Artists — separated cleanly without cross-over noise."}
          </p>
        </div>

        <SplitSectorLogo locale={locale} />
      </section>
    </>
  );
}