import type { CurrencyCode, Market, PaymentProvider } from "@/lib/market";

type LegacyPriceShape = {
  base_price?: number | null;
  final_price?: number | null;
  base_price_usd?: number | null;
  final_price_usd?: number | null;
  currency?: string | null;
  market?: string | null;
  provider?: string | null;
};

export function resolveOrderBasePrice(order: LegacyPriceShape) {
  return typeof order.base_price === "number" ? order.base_price : order.base_price_usd ?? 0;
}

export function resolveOrderFinalPrice(order: LegacyPriceShape) {
  return typeof order.final_price === "number" ? order.final_price : order.final_price_usd ?? resolveOrderBasePrice(order);
}

export function resolveOrderCurrency(order: LegacyPriceShape): CurrencyCode {
  return order.currency?.trim().toUpperCase() === "RUB" ? "RUB" : "USD";
}

export function resolveOrderMarket(order: LegacyPriceShape): Market {
  return order.market === "ru" ? "ru" : "global";
}

export function resolveOrderProvider(order: LegacyPriceShape): PaymentProvider | "internal" {
  if (order.provider === "lava" || order.provider === "internal") {
    return order.provider;
  }

  return "paypal";
}
