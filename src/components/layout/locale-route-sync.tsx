"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LocaleRouteSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem("hp_locale", locale);
      window.localStorage.setItem("hp_locale_confirmed", "1");
    } catch {}
  }, [locale]);

  return null;
}
