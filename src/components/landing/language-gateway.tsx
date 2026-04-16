"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LanguageGateway({ locale }: { locale: Locale }) {
  const router = useRouter();

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const seen = window.localStorage.getItem("hp_locale_confirmed");
      return !seen;
    } catch {
      return true;
    }
  });

  const choose = (nextLocale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem("hp_locale", nextLocale);
      window.localStorage.setItem("hp_locale_confirmed", "1");
    } catch {}
    setOpen(false);
    router.push(`/${nextLocale}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,5,6,0.82)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border border-[var(--color-line)] bg-[rgba(12,11,9,0.96)] p-6 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">Language</p>
        <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.06em] text-[var(--color-paper-100)]">
          {locale === "ru" ? "Выберите язык" : "Choose language"}
        </h2>
        <p className="mt-3 text-sm text-[var(--color-paper-200)]">
          {locale === "ru" ? "Язык можно изменить позже в шапке сайта." : "You can change the language later in the site header."}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => choose("en")} className="border border-[var(--color-line)] px-4 py-3 text-sm uppercase tracking-[0.2em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
            English
          </button>
          <button type="button" onClick={() => choose("ru")} className="border border-[var(--color-line)] px-4 py-3 text-sm uppercase tracking-[0.2em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(255,255,255,0.06)]">
            Русский
          </button>
        </div>
      </div>
    </div>
  );
}
