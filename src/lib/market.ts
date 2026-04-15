import type { Beat } from "@/types";
import type { Locale } from "@/lib/i18n";

export type Market = "global" | "ru";
export type CurrencyCode = "USD" | "RUB";
export type PaymentProvider = "paypal" | "lava";
export type SectorKey = "beats" | "vst" | "ham" | "artists";

export type MarketContext = {
  locale: Locale;
  market: Market;
  currency: CurrencyCode;
  paymentProvider: PaymentProvider;
  defaultBeatPrice: number;
};

export function normalizeLocale(value: string | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

export function getMarketContext(locale: Locale): MarketContext {
  if (locale === "ru") {
    return {
      locale,
      market: "ru",
      currency: "RUB",
      paymentProvider: "lava",
      defaultBeatPrice: 2500,
    };
  }

  return {
    locale,
    market: "global",
    currency: "USD",
    paymentProvider: "paypal",
    defaultBeatPrice: 100,
  };
}

export function getBeatPriceForLocale(beat: Pick<Beat, "priceUsd" | "priceRub">, locale: Locale) {
  return locale === "ru" ? beat.priceRub : beat.priceUsd;
}

export function formatMarketMoney(amount: number, currency: CurrencyCode, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const sectorLabels: Record<Locale, Record<SectorKey, string>> = {
  en: {
    beats: "Beats Archive",
    vst: "Drum Generator VST",
    ham: "HaM Hamilio",
    artists: "Artists",
  },
  ru: {
    beats: "Архив битов",
    vst: "Drum Generator VST",
    ham: "HaM Hamilio",
    artists: "Артисты",
  },
};
