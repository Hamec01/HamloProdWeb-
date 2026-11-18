"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StripePurchaseOption } from "./stripe-purchase-option";
import type { StripeUnavailableReason } from "@/lib/checkout/stripe-availability";

export function BeatInquiryActions({ beatId, beatSlug, isAuthenticated, locale, compact = false, stripeAvailable = false, stripeUnavailableReason, priceUsd, priceRub }: { beatId: string; beatSlug: string; isAuthenticated: boolean; locale: "ru" | "en"; compact?: boolean; stripeAvailable?: boolean; stripeUnavailableReason?: StripeUnavailableReason | null; priceUsd?: number; priceRub?: number }) {
  const router = useRouter();
  const chooser = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const manualAmount = locale === "ru" ? priceRub : priceUsd;
  const manualPrice = manualAmount === undefined ? "" : new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: locale === "ru" ? "RUB" : "USD", maximumFractionDigits: 0 }).format(manualAmount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(reserve: boolean) {
    chooser.current?.close();
    if (!isAuthenticated) { router.push(`/auth?next=${encodeURIComponent(`/beats/${beatSlug}`)}`); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/beats/${beatId}/inquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reserve }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) { setError(result.error || "Не удалось создать заявку."); return; }
      router.push(result.url); router.refresh();
    } catch { setError(locale === "ru" ? "Не удалось связаться с сервером." : "Could not reach the server."); }
    finally { setBusy(false); }
  }
  return <div className={compact ? "space-y-2" : "mt-5 space-y-3"}>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => { if (!chooser.current?.open) chooser.current?.showModal(); }} aria-haspopup="dialog" className="min-h-11 border border-amber-600 bg-amber-950/30 px-4 py-2 text-sm uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50">{locale === "ru" ? "Купить бит" : "Buy beat"}</button>
      <button type="button" disabled={busy} onClick={() => void open(false)} className="min-h-11 border border-stone-600 px-4 py-2 text-sm text-stone-200 disabled:opacity-50">{busy ? (locale === "ru" ? "Открываем…" : "Opening…") : locale === "ru" ? "Написать продавцу" : "Message producer"}</button>
      {!compact ? <button type="button" disabled={busy} onClick={() => void open(true)} className="min-h-11 border border-stone-600 px-4 py-2 text-sm text-stone-200 disabled:opacity-50">{locale === "ru" ? "Бронь на 7 дней" : "Reserve for 7 days"}</button> : null}
    </div>
    {!compact ? <p className="text-xs leading-5 text-stone-300">{locale === "ru" ? "Нажмите «Купить бит», чтобы выбрать Stripe, оплату через продавца или бронь." : "Choose Buy beat for Stripe, payment through the producer or a reservation."}</p> : null}
    <dialog ref={chooser} aria-labelledby={headingId} onClick={(event) => { if (event.target === event.currentTarget) chooser.current?.close(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto border border-stone-600 bg-[#11100e] p-0 text-stone-100 shadow-2xl backdrop:bg-black/80">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><h2 id={headingId} className="text-2xl">{locale === "ru" ? "Как купить бит" : "Choose how to buy"}</h2><button type="button" onClick={() => chooser.current?.close()} aria-label={locale === "ru" ? "Закрыть выбор оплаты" : "Close purchase options"} className="flex h-10 w-10 items-center justify-center border border-stone-600 text-xl">×</button></div>
        <section className="space-y-3 border border-amber-900/70 p-4">
          <h3 className="text-lg">{locale === "ru" ? "Картой через Stripe" : "Card payment with Stripe"}</h3>
          <p className="text-xs leading-5 text-stone-300">{locale === "ru" ? "Оплата в USD. После подтверждения оплаты PDF, файл бита и 25 поинтов появятся в кабинете." : "Pay in USD. Your PDF, beat file and 25 points appear in your account after payment."}</p>
          <StripePurchaseOption href={`/checkout/${encodeURIComponent(beatSlug)}?payment=stripe`} priceUsd={priceUsd} available={stripeAvailable} reason={stripeUnavailableReason} locale={locale} />
        </section>
        <section className="space-y-3 border border-stone-700 p-4">
          <h3 className="text-lg">{locale === "ru" ? "Через продавца" : "Through the producer"}{manualPrice ? ` · ${manualPrice}` : ""}</h3>
          <p className="text-xs leading-5 text-stone-300">{locale === "ru" ? "Заполните данные для лицензии. Затем продавец пришлёт ссылку на оплату в переписке. После подтверждения оплаты вы получите PDF, файл бита и 25 поинтов." : "Enter your license details, then receive a payment link in site messages. Once the producer confirms payment, your account receives the PDF, beat file and 25 points."}</p>
          <Link href={`/checkout/${encodeURIComponent(beatSlug)}?payment=contact`} className="inline-flex min-h-11 items-center border border-amber-700 bg-amber-950/20 px-4 py-2 text-sm">{locale === "ru" ? "Купить бит через сайт" : "Buy through the site"}</Link>
        </section>
        <button type="button" disabled={busy} onClick={() => void open(true)} className="min-h-11 w-full border border-stone-600 px-4 py-3 text-sm disabled:opacity-50">{locale === "ru" ? "Забронировать на 7 дней" : "Reserve for 7 days"}</button>
      </div>
    </dialog>
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
  </div>;
}
