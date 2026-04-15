import { LanguageGateway } from "@/components/landing/language-gateway";
import { SplitSectorLogo } from "@/components/landing/split-sector-logo";
import { normalizeLocale, sectorLabels } from "@/lib/market";

export default async function LocaleLandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return (
    <>
      <LanguageGateway locale={locale} />

      <section className="space-y-8 pt-6 text-center sm:pt-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.36em] text-[var(--color-paper-400)]">HamloProd</p>
          <h1 className="font-sans text-6xl uppercase tracking-[0.06em] text-[var(--color-paper-100)] sm:text-8xl">
            {locale === "ru" ? "Секторы проекта" : "Project Sectors"}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-[var(--color-paper-200)]">
            {locale === "ru"
              ? "Выбери направление. Внутри каждого сектора остаётся только его собственная витрина, профиль и авторизация."
              : "Choose a direction. Inside each sector, only its own storefront, profile and auth remain visible."}
          </p>
        </div>

        <SplitSectorLogo locale={locale} />

        <div className="grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {(["beats", "vst", "ham", "artists"] as const).map((key) => (
            <div key={key} className="border border-[var(--color-line)] bg-[rgba(14,13,12,0.72)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-100)]">{sectorLabels[locale][key]}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
