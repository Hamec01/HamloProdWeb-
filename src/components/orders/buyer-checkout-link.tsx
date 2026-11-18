"use client";

import { useId, useState } from "react";

export function BuyerCheckoutLink({ beatSlug }: { beatSlug: string }) {
  const [message, setMessage] = useState("");
  const id = useId();
  const path = `/checkout/${encodeURIComponent(beatSlug)}?payment=contact`;
  return <div className="space-y-2 border border-stone-700 p-3">
    <label htmlFor={id} className="block text-sm">Форма данных для покупателя</label>
    <input id={id} readOnly value={path} onClick={(event) => event.currentTarget.select()} className="w-full border border-stone-600 bg-black/40 px-3 py-2 text-sm" />
    <button type="button" className="border border-stone-600 px-3 py-2 text-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setMessage("Ссылка скопирована. Отправьте её покупателю в переписке."); }
      catch { setMessage("Скопируйте путь из поля и добавьте перед ним https://hamloprod.org"); }
    }}>Скопировать ссылку на форму</button>
    {message ? <p role="status" className="text-xs text-amber-200">{message}</p> : null}
  </div>;
}
