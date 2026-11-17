"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BeatInquiryActions({ beatId, beatSlug, isAuthenticated, locale, compact = false }: { beatId: string; beatSlug: string; isAuthenticated: boolean; locale: "ru" | "en"; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open(reserve: boolean) {
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
      <button type="button" disabled={busy} onClick={() => void open(false)} className="border border-amber-700 bg-amber-950/30 px-4 py-2 text-sm uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50">{busy ? (locale === "ru" ? "Открываем…" : "Opening…") : locale === "ru" ? "Купить бит / написать" : "Buy Beat / Message"}</button>
      {!compact ? <button type="button" disabled={busy} onClick={() => void open(true)} className="border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-paper-100)] disabled:opacity-50">{locale === "ru" ? "Бронь на 7 дней" : "Reserve for 7 days"}</button> : null}
    </div>
    {!compact ? <p className="text-xs leading-5 text-[var(--color-paper-300)]">{locale === "ru" ? "Обсудите оплату с продавцом прямо на сайте. После подтверждения оплаты лицензия появится в заказе и профиле." : "Discuss payment with the producer here on the site. Your license appears in the order and profile once payment is confirmed."}</p> : null}
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
  </div>;
}
