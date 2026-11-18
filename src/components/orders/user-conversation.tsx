"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { getUserConversation } from "@/lib/users/service";

type Conversation = Awaited<ReturnType<typeof getUserConversation>>;
const merge = (a: Conversation["messages"], b: Conversation["messages"]) => [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
const button = "border border-stone-600 px-4 py-3 text-sm text-stone-100 hover:border-amber-400 disabled:opacity-50";

export function UserConversation({ initial, role, locale = "ru" }: { initial: Conversation; role: "buyer" | "admin"; locale?: "ru" | "en" }) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const nonce = useRef<{ text: string; id: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const userId = initial.user.id;
  const ru = locale === "ru";
  const endpoint = `/api/users/${userId}/messages`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    if (!response.ok) throw new Error("REFRESH_FAILED");
    const next = await response.json() as Conversation;
    setMessages((previous) => merge(previous, next.messages));
    setConnection("");
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    void refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setConnection(ru ? "Обновление переписки недоступно. Повторяем подключение…" : "Reconnecting to messages…");
    });
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || loading) return;
      loading = true;
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) setConnection(ru ? "Обновление переписки недоступно. Повторяем подключение…" : "Reconnecting to messages…"); }
      finally { loading = false; }
    }, 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh, ru]);
  useEffect(() => { if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages.length]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    const value = text.trim();
    if (nonce.current?.text !== value) nonce.current = { text: value, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value, clientMessageId: nonce.current.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setText(""); nonce.current = null; atBottom.current = true;
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : (ru ? "Не удалось отправить." : "Could not send.")); }
    finally { setBusy(false); }
  }
  async function older() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${endpoint}?before=${messages[0].id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const next = result as Conversation;
      atBottom.current = false;
      setMessages((previous) => merge(previous, next.messages)); setHasMore(next.hasMore);
    } catch { setError(ru ? "Не удалось загрузить историю." : "Could not load history."); }
    finally { setBusy(false); }
  }
  return <section className="case-panel space-y-4 p-5 sm:p-6">
    <h2 className="text-2xl">{ru ? (role === "admin" ? "Личная переписка с пользователем" : "Переписка с HaM") : "Messages with HaM"}</h2>
    <p className="text-sm text-stone-300">{ru ? "Этот диалог сохраняется в кабинете и не привязан к отдельному биту." : "This private conversation stays in your account, independently of beat orders."}</p>
    {connection ? <p role="status" className="text-sm text-amber-200">{connection}</p> : null}
    {hasMore ? <button type="button" className={button} disabled={busy} onClick={() => void older()}>{ru ? "Ранние сообщения" : "Earlier messages"}</button> : null}
    <div ref={scroll} onScroll={(event) => { const el = event.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="max-h-[30rem] space-y-3 overflow-y-auto" role="log" aria-live="polite" aria-label={ru ? "Личные сообщения" : "Private messages"}>
      {messages.map((message) => <div key={message.id} className={`border p-4 ${message.role === role ? "border-amber-800 bg-amber-950/20" : "border-stone-600 bg-stone-950"}`}>
        <p className="text-xs text-stone-400">{message.role === "admin" ? "HaM" : ru ? "Пользователь" : "Customer"} · {new Intl.DateTimeFormat(ru ? "ru-RU" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(new Date(message.createdAt))}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
      </div>)}
      {!messages.length ? <p className="text-sm text-stone-400">{ru ? "Сообщений пока нет. Можно написать первым." : "No messages yet. You can start the conversation."}</p> : null}
    </div>
    <form onSubmit={send} className="space-y-3">
      <label className="block text-sm" htmlFor="direct-message">{ru ? "Личное сообщение" : "Your message"}</label>
      <textarea id="direct-message" rows={3} maxLength={4000} required disabled={busy} value={text} onChange={(event) => setText(event.target.value)} className="w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" />
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" disabled={busy || !text.trim()} className={button}>{busy ? (ru ? "Отправляем…" : "Sending…") : ru ? "Отправить сообщение" : "Send message"}</button>
    </form>
    <p className="text-xs text-stone-400">{ru ? "Сообщения обновляются автоматически. Время — Хельсинки." : "Messages refresh automatically. Times are shown in Helsinki time."}</p>
  </section>;
}
