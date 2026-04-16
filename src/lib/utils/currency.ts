export function formatMoney(value: number, currency: string | null | undefined, locale: "ru" | "en") {
  const resolvedCurrency = (currency?.trim() || "USD").toUpperCase();
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
}
