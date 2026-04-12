import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export async function PublicFooter() {
  const locale = await getLocale();
  const t = dictionary[locale];

  return (
    <footer className="border-t border-[var(--color-line)] px-6 py-8 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </div>
    </footer>
  );
}