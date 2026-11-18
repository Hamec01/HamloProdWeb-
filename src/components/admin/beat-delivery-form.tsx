"use client";
import { useEffect, useState, type FormEvent } from "react";
export function BeatDeliveryForm({ beatId }: { beatId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/beats/${beatId}/delivery`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw Error("Не удалось загрузить ссылку.");
      const result = await response.json(); if (!controller.signal.aborted) { setUrl(result.url); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setError("Не удалось загрузить ссылку. Откройте редактирование бита ещё раз."); setLoading(false); } });
    return () => controller.abort();
  }, [beatId]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setSaved(false); setError("");
    try {
      const response = await fetch(`/api/admin/beats/${beatId}/delivery`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить ссылку."); }
    finally { setSaving(false); }
  }
  return <section className="case-panel space-y-4 p-6">
    <h2 className="text-2xl">Файл бита после покупки</h2>
    <p className="text-sm text-stone-300">Скрытая ссылка Google Диска. Покупатель получит её в заказе и кабинете после подтверждения оплаты. Для доступа к файлу настрой на Диске «Все, у кого есть ссылка».</p>
    <form onSubmit={save} className="space-y-3">
      <label htmlFor="beat-drive-url" className="block text-sm">Ссылка на файл или папку</label>
      <input id="beat-drive-url" type="url" maxLength={4000} value={url} disabled={loading || saving} onChange={(event) => { setUrl(event.target.value); setSaved(false); }} placeholder="https://drive.google.com/file/d/…/view" className="w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" />
      <button type="submit" disabled={loading || saving || Boolean(error && !url)} className="border border-stone-600 px-4 py-3 text-sm disabled:opacity-50">{loading ? "Загружаем…" : saving ? "Сохраняем…" : "Сохранить ссылку Google Диска"}</button>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      {saved ? <p role="status" className="text-sm text-amber-200">Ссылка сохранена. Она скрыта до покупки.</p> : null}
    </form>
  </section>;
}
