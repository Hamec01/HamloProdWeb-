"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  const setLocale = (nextLocale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-1 border border-[var(--color-line)] px-1 py-1 text-[10px] uppercase tracking-[0.22em] text-[var(--color-paper-200)]">
      <button
        type="button"
        onClick={() => setLocale("ru")}
        className={`px-2 py-1 transition-colors ${locale === "ru" ? "bg-[rgba(255,255,255,0.14)] text-[var(--color-paper-100)]" : "hover:bg-[rgba(255,255,255,0.06)]"}`}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-2 py-1 transition-colors ${locale === "en" ? "bg-[rgba(255,255,255,0.14)] text-[var(--color-paper-100)]" : "hover:bg-[rgba(255,255,255,0.06)]"}`}
      >
        EN
      </button>
    </div>
  );
}
