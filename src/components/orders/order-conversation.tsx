"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { getConversation } from "@/lib/orders/conversation";

type Conversation = Awaited<ReturnType<typeof getConversation>>;
const merge = (first: Conversation["messages"], second: Conversation["messages"]) => [...new Map([...first, ...second].map((m) => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
const buttonClass = "border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-paper-100)] disabled:opacity-50";

export function OrderConversation({ initial, role, locale }: { initial: Conversation; role: "buyer" | "admin"; locale: "ru" | "en" }) {
  const [data, setData] = useState(initial);
  const [olderAvailable, setOlderAvailable] = useState(initial.hasMore);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const nonce = useRef<{ text: string; id: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const orderId = initial.order.id;
  const ru = locale === "ru";
  const date = (value: string) => new Intl.DateTimeFormat(ru ? "ru-RU" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(new Date(value));

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("REFRESH_FAILED");
      const next = await response.json() as Conversation;
      setData((previous) => ({ ...next, messages: merge(previous.messages, next.messages) }));
      setConnectionError("");
    } catch {
      if (!signal?.aborted) setConnectionError(locale === "ru" ? "Не удалось обновить переписку. Повторяем подключение…" : "Could not refresh messages. Reconnecting…");
    }
  }, [orderId, locale]);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || loading) return;
      loading = true; await refresh(controller.signal); loading = false;
    }, 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [data.messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault(); if (!text.trim()) return;
    setBusy("message"); setError("");
    const value = text.trim();
    if (nonce.current?.text !== value) nonce.current = { text: value, id: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, clientMessageId: nonce.current.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "Не удалось отправить сообщение."); return; }
      setText(""); nonce.current = null; atBottom.current = true; await refresh();
    } catch { setError(ru ? "Сообщение не отправлено. Повторите попытку." : "Message not sent. Please retry."); }
    finally { setBusy(""); }
  }
  async function action(kind: "reserve" | "release" | "confirm" | "redeem" | "pdf") {
    setBusy(kind); setError("");
    const path = kind === "confirm" || kind === "pdf" ? `/api/admin/licenses/${orderId}/${kind}` : `/api/orders/${orderId}/${kind === "reserve" || kind === "release" ? "reservation" : "redeem"}`;
    try {
      const response = await fetch(path, { method: kind === "release" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, ...(kind === "confirm" ? { body: JSON.stringify({ paymentReceived }) } : {}) });
      const result = await response.json() as { error?: string; downloadUrl?: string };
      if (!response.ok) { setError(result.error || "Действие не выполнено."); return; }
      if (result.downloadUrl) setPdfUrl(result.downloadUrl);
      await refresh();
    } catch { setError(ru ? "Не удалось связаться с сервером." : "Could not reach the server."); }
    finally { setBusy(""); }
  }
  async function loadOlder() {
    if (!data.messages.length) return;
    setBusy("older");
    try {
      const response = await fetch(`/api/orders/${orderId}/messages?before=${data.messages[0].id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("OLDER_FAILED");
      const next = await response.json() as Conversation;
      atBottom.current = false;
      setData((previous) => ({ ...previous, messages: merge(next.messages, previous.messages) }));
      setOlderAvailable(next.hasMore);
    } catch { setError(ru ? "Не удалось загрузить старые сообщения." : "Could not load older messages."); }
    finally { setBusy(""); }
  }
  const order = data.order;
  return <div className="space-y-6">
    {error ? <p role="alert" className="case-panel p-4 text-sm text-red-300">{error}</p> : null}
    <section className="case-panel p-5 space-y-4">
      <p className="break-all text-xs text-[var(--color-paper-400)]">{ru ? "Заявка" : "Request"}: {order.id}</p>
      <h1 className="text-3xl">{order.beatTitle}</h1>
      <p className="text-sm">{order.amount === 0 ? (ru ? "Бесплатно" : "Free") : new Intl.NumberFormat(ru ? "ru-RU" : "en-US", { style: "currency", currency: order.currency }).format(order.amount)} · {order.status === "paid" ? (ru ? "Покупка подтверждена" : "Purchase confirmed") : ru ? "Обсуждение покупки" : "Purchase request"}</p>
      {role === "admin" ? <p className="text-sm text-[var(--color-paper-200)]">{order.buyerName || order.buyerEmail} · {order.buyerEmail}</p> : null}
      {order.reservationExpiresAt ? <div className="border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100">
        <p>{order.reservationIsOurs ? (ru ? "Бит забронирован по вашей заявке" : "Reserved for this request") : ru ? "Бит забронирован по другой заявке" : "Reserved for another request"} {ru ? "до" : "until"} {date(order.reservationExpiresAt)} ({ru ? "Хельсинки" : "Helsinki"}).</p>
        {order.reservationIsOurs ? <button className={`${buttonClass} mt-3`} disabled={Boolean(busy)} onClick={() => void action("release")}>{ru ? "Снять бронь" : "Cancel reservation"}</button> : null}
      </div> : null}
      {order.status === "draft" && !order.sold ? <div className="flex flex-wrap gap-3">
        {!order.reservationExpiresAt ? <button className={buttonClass} disabled={Boolean(busy)} onClick={() => void action("reserve")}>{ru ? "Забронировать на 7 дней" : "Reserve for 7 days"}</button> : null}
        {role === "buyer" ? <Link className={buttonClass} href={`/checkout/${encodeURIComponent(order.beatSlug)}`}>{ru ? "Заполнить данные для лицензии / использовать поинты" : "License details / Use points"}</Link> : null}
        {order.hasContract && role === "buyer" ? <Link className={buttonClass} href={`/checkout/preview/${order.id}`}>{ru ? "Просмотреть договор" : "Review agreement"}</Link> : null}
      </div> : null}
      {!order.hasContract && order.status === "draft" ? <p className="text-sm text-amber-200">{ru ? "Для выдачи лицензии покупателю нужно заполнить данные и принять условия договора." : "The buyer must complete their details and accept the agreement before a license can be issued."}</p> : null}
      {role === "buyer" && order.status === "draft" && order.hasContract && order.redeemable && !order.sold ? <button className={buttonClass} disabled={Boolean(busy) || order.points < 100} onClick={() => void action("redeem")}>{ru ? "Получить бит за 100 поинтов" : "Get beat for 100 points"}</button> : null}
      {role === "admin" && order.status === "draft" && order.hasContract && !order.sold ? <div className="border-t border-[var(--color-line)] pt-4 space-y-3">
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={paymentReceived} onChange={(event) => setPaymentReceived(event.target.checked)} />{ru ? "Подтверждаю получение оплаты (или согласованный обмен поинтов)" : "Payment received (or agreed points redemption)"}</label>
        <button className={buttonClass} disabled={Boolean(busy) || !paymentReceived} onClick={() => void action("confirm")}>{ru ? "Подтвердить покупку и выдать PDF" : "Confirm purchase and issue PDF"}</button>
      </div> : null}
      {order.status === "paid" || order.status === "pending_free_checkout" ? <div className="flex flex-wrap gap-3">
        {role === "buyer" ? <a href={`/api/contracts/${orderId}/download`} className={buttonClass} target="_blank" rel="noreferrer">{ru ? "Скачать лицензию PDF" : "Download license PDF"}</a> : <button className={buttonClass} disabled={Boolean(busy)} onClick={() => void action("pdf")}>{ru ? "Подготовить PDF" : "Prepare PDF"}</button>}
        {pdfUrl ? <a className={buttonClass} href={pdfUrl} target="_blank" rel="noreferrer">{ru ? "Скачать PDF" : "Download PDF"}</a> : null}
      </div> : null}
      {order.sold && order.status === "draft" ? <p className="text-red-300">{ru ? "Бит уже продан. Обсудите с продавцом другие варианты." : "The beat is sold. Contact the producer for alternatives."}</p> : null}
    </section>
    <section className="case-panel p-5 space-y-4">
      <h2 className="text-2xl">{ru ? "Переписка по заявке" : "Request messages"}</h2>
      {connectionError ? <p role="status" className="text-sm text-amber-200">{connectionError}</p> : null}
      {olderAvailable ? <button className={buttonClass} disabled={Boolean(busy)} onClick={() => void loadOlder()}>{ru ? "Ранние сообщения" : "Earlier messages"}</button> : null}
      <div ref={scroll} onScroll={(event) => { const el = event.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="max-h-[30rem] space-y-3 overflow-y-auto" aria-live="polite" role="log" aria-label={ru ? "Сообщения" : "Messages"}>
        {data.messages.map((message) => <div key={message.id} className={`border p-4 ${message.role === "system" ? "border-stone-700 text-stone-300" : message.role === role ? "border-amber-800 bg-amber-950/20" : "border-stone-600 bg-stone-950"}`}>
          <p className="text-xs text-[var(--color-paper-300)]">{message.role === "system" ? (ru ? "Событие" : "Event") : message.role === "admin" ? (ru ? "Продавец" : "Producer") : (ru ? "Покупатель" : "Buyer")} · {date(message.createdAt)}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
        </div>)}
        {!data.messages.length ? <p className="text-sm text-[var(--color-paper-300)]">{ru ? "Напишите первое сообщение продавцу." : "Send your first message to the producer."}</p> : null}
      </div>
      <form onSubmit={send} className="space-y-3">
        <label className="block text-sm" htmlFor="order-message">{ru ? "Ваше сообщение" : "Your message"}</label>
        <textarea id="order-message" required maxLength={4000} rows={3} value={text} onChange={(event) => setText(event.target.value)} className="w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" />
        <button type="submit" disabled={Boolean(busy) || !text.trim()} className={buttonClass}>{busy === "message" ? (ru ? "Отправляем…" : "Sending…") : ru ? "Отправить" : "Send"}</button>
      </form>
      <p className="text-xs text-stone-400">{ru ? "Сообщения обновляются автоматически. Время указано по Хельсинки." : "Messages refresh automatically. Times are shown in Helsinki time."}</p>
    </section>
  </div>;
}
