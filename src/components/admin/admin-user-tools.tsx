"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { listPrivateNotes, listPointGrants } from "@/lib/users/service";

type Notes = Awaited<ReturnType<typeof listPrivateNotes>>;
type Grants = Awaited<ReturnType<typeof listPointGrants>>;
const inputClass = "w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100";
const buttonClass = "border border-stone-600 px-4 py-3 text-sm text-stone-100 hover:border-amber-400 disabled:opacity-50";
const date = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(new Date(value));

export function AdminUserTools({ userId, initialNotes, initialGrants, initialPoints }: { userId: string; initialNotes: Notes; initialGrants: Grants; initialPoints: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [grants, setGrants] = useState(initialGrants);
  const [points, setPoints] = useState(initialPoints);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("25");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ action: string; text: string } | null>(null);
  const [success, setSuccess] = useState("");
  const nonces = useRef<Partial<Record<"notes" | "points", { value: string; id: string }>>>({});
  async function submit(action: "notes" | "points", event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const payload = action === "notes" ? { text: note.trim() } : { amount: Number(amount), reason: reason.trim() };
    const value = JSON.stringify({ action, ...payload });
    if (nonces.current[action]?.value !== value) nonces.current[action] = { value, id: crypto.randomUUID() };
    setBusy(action); setError(null); setSuccess("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: nonces.current[action]!.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      // Refresh history independently; a failed read must retain the mutation nonce.
      const history = await fetch(`/api/admin/users/${userId}/${action}`, { cache: "no-store" });
      if (!history.ok) throw new Error("Сохранено, но история не обновилась. Повторите — дубликат не создастся.");
      const next = await history.json();
      if (action === "notes") { setNotes(next); setNote(""); setSuccess("Пометка сохранена. Пользователь её не видит."); }
      else { setGrants(next); setPoints(result.points); setReason(""); setSuccess(`Поинты начислены. Баланс: ${result.points}.`); }
      delete nonces.current[action]; router.refresh();
    } catch (error) { setError({ action, text: error instanceof Error ? error.message : "Не удалось сохранить." }); }
    finally { setBusy(""); }
  }
  async function older(action: "notes" | "points") {
    const items = action === "notes" ? notes.items : grants.items;
    if (busy || !items.length) return;
    setBusy(action); setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}?before=${items.at(-1)!.id}`, { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error);
      if (action === "notes") setNotes((prev) => ({ items: [...prev.items, ...(next as Notes).items], hasMore: next.hasMore }));
      else setGrants((prev) => ({ items: [...prev.items, ...(next as Grants).items], hasMore: next.hasMore }));
    } catch { setError({ action, text: "Не удалось загрузить историю." }); }
    finally { setBusy(""); }
  }
  return <div className="space-y-6">
    {success ? <p role="status" className="border border-amber-700 p-4 text-sm text-amber-200">{success}</p> : null}
    <section className="case-panel space-y-5 p-5 sm:p-6">
      <h2 className="text-2xl">Твои пометки</h2>
      <p className="text-sm text-stone-300">Закрытая история для администратора. Эти записи не отправляются пользователю.</p>
      <form onSubmit={(event) => void submit("notes", event)} className="space-y-3">
        <label htmlFor="private-note" className="block text-sm">Новая пометка</label>
        <textarea id="private-note" rows={3} maxLength={4000} required disabled={Boolean(busy)} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
        {error?.action === "notes" ? <p role="alert" className="text-red-300">{error.text}</p> : null}
        <button className={buttonClass} disabled={Boolean(busy) || !note.trim()} type="submit">Сохранить пометку</button>
      </form>
      <div className="space-y-3">{notes.items.map((entry) => <article key={entry.id} className="border border-stone-700 p-4"><p className="text-xs text-stone-400">{date(entry.createdAt)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.text}</p></article>)}</div>
      {notes.hasMore ? <button type="button" disabled={Boolean(busy)} onClick={() => void older("notes")} className={buttonClass}>Ранние пометки</button> : null}
    </section>
    <section className="case-panel space-y-5 p-5 sm:p-6">
      <h2 className="text-2xl">Начислить поинты</h2>
      <p className="text-sm text-stone-300">Баланс: <strong data-testid="managed-points">{points}</strong>. 100 поинтов = один бесплатный бит.</p>
      <form onSubmit={(event) => void submit("points", event)} className="space-y-3">
        <label htmlFor="grant-amount" className="block text-sm">Количество поинтов</label>
        <input id="grant-amount" type="number" min={1} max={10000} step={1} required disabled={Boolean(busy)} value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} />
        <label htmlFor="grant-reason" className="block text-sm">Причина начисления — видна пользователю</label>
        <input id="grant-reason" type="text" maxLength={500} required disabled={Boolean(busy)} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
        {error?.action === "points" ? <p role="alert" className="text-red-300">{error.text}</p> : null}
        <button type="submit" className={buttonClass} disabled={Boolean(busy) || !reason.trim()}>Начислить поинты</button>
      </form>
      <h3 className="text-sm uppercase tracking-wider">История ручных начислений</h3>
      {!grants.items.length ? <p className="text-sm text-stone-400">Начислений пока нет.</p> : null}
      <div className="space-y-3">{grants.items.map((entry) => <article key={entry.id} className="border border-stone-700 p-4"><p className="text-sm text-amber-200">+{entry.amount} · {date(entry.createdAt)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.reason}</p></article>)}</div>
      {grants.hasMore ? <button type="button" disabled={Boolean(busy)} onClick={() => void older("points")} className={buttonClass}>Ранние начисления</button> : null}
    </section>
  </div>;
}
