"use client";

import { useEffect, useId, useState } from "react";

export type RegisteredBuyer = { id: string; email: string; displayName: string | null; points: number };

export function RegisteredBuyerPicker({ selected, onSelect }: { selected: RegisteredBuyer | null; onSelect: (buyer: RegisteredBuyer | null) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<RegisteredBuyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2 || selected) { setUsers([]); setLoading(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/admin/licenses/buyers?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("SEARCH_FAILED");
        const result = await response.json() as { users: RegisteredBuyer[] };
        if (!controller.signal.aborted) setUsers(result.users);
      } catch {
        if (!controller.signal.aborted) setError("Не удалось найти аккаунты. Повторите поиск.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected]);

  return <div className="space-y-3 border border-[var(--color-line)] bg-[#11100e] p-4 sm:col-span-2">
    <label htmlFor={id} className="block text-xs uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Аккаунт покупателя (необязательно)</label>
    {selected ? <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-600 bg-amber-950/30 p-3 text-sm text-amber-100">
      <div><p>{selected.displayName || selected.email}</p><p className="mt-1 break-all text-xs">{selected.email} · {selected.points} балл.</p><p className="mt-2 text-xs">Покупка и PDF появятся в этом аккаунте. За продажу начислится 1 балл.</p></div>
      <button type="button" className="underline" onClick={() => { onSelect(null); setQuery(""); }}>Сменить аккаунт</button>
    </div> : <>
      <input id={id} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setUsers([]); }} placeholder="Найти по email или имени" autoComplete="off" className="w-full border border-stone-600 bg-[#080808] px-3 py-3 text-base text-stone-100 outline-none focus:border-amber-500" />
      {loading ? <p className="text-sm" role="status">Ищем аккаунт…</p> : null}
      {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
      {users.length ? <ul className="max-h-64 space-y-2 overflow-y-auto">{users.map((user) => <li key={user.id}><button type="button" onClick={() => { onSelect(user); setQuery(""); setUsers([]); }} className="w-full border border-stone-700 bg-[#171614] p-3 text-left text-stone-100 hover:border-amber-500 focus-visible:outline-2 focus-visible:outline-amber-400">
        <span className="block text-base">{user.displayName || user.email}</span><span className="mt-1 block break-all text-xs text-stone-300">{user.email} · {user.points} балл.</span>
      </button></li>)}</ul> : null}
      {!loading && !error && query.trim().length >= 2 && !users.length ? <p className="text-xs text-stone-300">Начните поиск или уточните email. Без выбора аккаунта данные покупателя можно заполнить вручную.</p> : null}
    </>}
    {selected ? <input type="hidden" name="buyerUserId" value={selected.id} /> : null}
  </div>;
}
