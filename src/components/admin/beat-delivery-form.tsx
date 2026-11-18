"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadBeatAsset } from "@/lib/storage/client-upload";
import type { AdminBeat } from "@/types/beat";

export function BeatDeliveryForm({ beatId, onSaved, onArchiveAttached }: { beatId: string; onSaved?: () => void; onArchiveAttached?: (beat: AdminBeat) => void }) {
  const fieldId = useId();
  const router = useRouter();
  const upload = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [storedUrl, setStoredUrl] = useState("");
  const [hasArchive, setHasArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/beats/${beatId}/delivery`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw Error("Не удалось загрузить файл для выдачи.");
      const result = await response.json();
      if (!controller.signal.aborted) { setUrl(result.url); setStoredUrl(result.url); setHasArchive(result.hasArchive); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setError("Не удалось загрузить файл для выдачи. Откройте редактирование ещё раз."); setLoading(false); } });
    return () => { controller.abort(); upload.current?.abort(); };
  }, [beatId]);
  async function save() {
    setSaving(true); setSaved(false); setError("");
    try {
      const response = await fetch(`/api/admin/beats/${beatId}/delivery`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      setStoredUrl(url.trim()); setSaved(true); onSaved?.(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить ссылку."); }
    finally { setSaving(false); }
  }
  async function uploadZip(file: File) {
    if (!/\.zip$/i.test(file.name) || file.size < 1 || file.size > 2 * 1024 ** 3) { setError("Выберите ZIP размером до 2 ГБ."); return; }
    const controller = new AbortController(); upload.current = controller;
    setUploading(true); setProgress(0); setError("");
    try {
      const beat = await uploadBeatAsset(beatId, "beat-archive", file, { signal: controller.signal, onProgress: setProgress });
      setHasArchive(beat.hasArchive); onArchiveAttached?.(beat); onSaved?.(); router.refresh();
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить ZIP."); }
    finally { upload.current = null; setUploading(false); }
  }
  return <section className="case-panel space-y-4 p-5">
    <h2 className="text-2xl">Файл бита после покупки: ссылка или ZIP</h2>
    <p className="text-sm text-stone-300">Сначала сохраните ссылку или загрузите ZIP, затем подтвердите оплату. Покупатель получит файл и PDF в кабинете после подтверждения покупки.</p>
    {!loading ? <p role="status" className={`text-sm ${storedUrl || hasArchive ? "text-amber-200" : "text-stone-400"}`}>{storedUrl || hasArchive ? `Файл готов к выдаче${storedUrl ? " · ссылка сохранена" : ""}${hasArchive ? " · ZIP загружен" : ""}` : "Файл ещё не подготовлен — подтверждение продажи недоступно."}</p> : null}
    <div className="space-y-3">
      <label htmlFor={fieldId} className="block text-sm">Ссылка на бит после покупки (Google Диск)</label>
      <input id={fieldId} data-beat-delivery-url type="url" maxLength={4000} value={url} disabled={loading || saving || uploading} onChange={(event) => { setUrl(event.target.value); setError(""); setSaved(false); }} placeholder="https://drive.google.com/file/d/…/view" className="w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" />
      <p className="text-xs text-stone-400">На Диске включите доступ «Все, у кого есть ссылка». Сама ссылка скрыта до покупки.</p>
      <button type="button" onClick={() => void save()} disabled={loading || saving || uploading} className="border border-amber-700 bg-amber-950/20 px-4 py-3 text-sm disabled:opacity-50">{loading ? "Загружаем…" : saving ? "Сохраняем…" : "Сохранить ссылку Google Диска"}</button>
      {saved ? <p role="status" className="text-sm text-amber-200">Ссылка сохранена.</p> : null}
    </div>
    <div className="space-y-3 border-t border-stone-700 pt-4">
      <label htmlFor={`${fieldId}-zip`} className="block text-sm">Или загрузить ZIP на сайт (до 2 ГБ)</label>
      <input id={`${fieldId}-zip`} data-beat-delivery-zip type="file" accept=".zip,application/zip,application/x-zip-compressed" disabled={loading || saving || uploading} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadZip(file); }} className="block w-full min-w-0 border border-stone-600 bg-black/40 px-3 py-3 text-sm" />
      <p className="text-xs text-stone-400">ZIP хранится в закрытом хранилище. Скачивание доступно покупателю оплаченного заказа.</p>
      {uploading ? <div role="status" className="space-y-2 text-sm"><p>Загрузка ZIP: {progress}%</p><progress max={100} value={progress} className="w-full" /><button type="button" className="border border-stone-600 px-3 py-2" onClick={() => upload.current?.abort()}>Отменить загрузку</button></div> : null}
    </div>
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
  </section>;
}
