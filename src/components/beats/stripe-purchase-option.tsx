import Link from "next/link";
import type { StripeUnavailableReason } from "@/lib/checkout/stripe-availability";

export function StripePurchaseOption({ href, priceUsd, available, reason, locale }: { href: string; priceUsd?: number; available: boolean; reason?: StripeUnavailableReason | null; locale: "ru" | "en" }) {
  const ru = locale === "ru";
  const label = `${ru ? "Купить через Stripe" : "Buy with Stripe"}${priceUsd !== undefined && priceUsd > 0 ? ` · $${priceUsd}` : ""}`;
  const style = "inline-flex min-h-11 items-center justify-center border border-amber-500 bg-amber-950/30 px-4 py-2 text-sm text-amber-100";
  const explanation = reason === "file" ? (ru ? "Файл бита для автоматической выдачи ещё готовится. Пока можно написать продавцу или забронировать бит." : "The beat file is being prepared for automatic delivery. You can message the producer or reserve the beat.") : reason === "price" ? (ru ? "Цена для оплаты картой пока уточняется. Напишите продавцу." : "The card-payment price is being confirmed. Please message the producer.") : (ru ? "Оплата картой временно недоступна. Можно договориться с продавцом в переписке." : "Card payments are temporarily unavailable. You can arrange payment with the producer through messages.");
  return <div className="space-y-2">
    {available ? <Link href={href} className={style}>{label}</Link> : <button type="button" disabled className={`${style} cursor-not-allowed border-stone-600 bg-stone-900/60 text-stone-400`}>{label}</button>}
    {!available ? <p className="max-w-lg text-xs leading-5 text-stone-300" role="status">{explanation}</p> : null}
  </div>;
}
