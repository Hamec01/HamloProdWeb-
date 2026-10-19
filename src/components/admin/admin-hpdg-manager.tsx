"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminHpdgRelease, AdminLicenseKey, IssueOutcome } from "@/lib/hpdg/postgres";
import { parseStripePayments, type StripePayment } from "@/lib/hpdg/stripe-csv";

const input = "w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none";
const label = "text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]";
const panel = "case-panel space-y-4 p-6";
const muted = "text-xs text-[var(--color-paper-400)]";
const alert = "text-xs text-[var(--color-alert)]";

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status}).`);
  return data as T;
}

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check connection and storage CORS."));
    xhr.send(file);
  });
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—");

function versionFromFileName(name: string): string {
  return /_(\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?)\.exe$/i.exec(name)?.[1] ?? "";
}

function titleFromVersion(version: string): string {
  const match = /^(\d+\.\d+\.\d+)(?:-([a-z]+)\.(\d+))?$/.exec(version);
  if (!match) return "";
  const label = match[2] ? ` ${match[2] === "rc" ? "RC" : match[2][0].toUpperCase() + match[2].slice(1)} ${match[3]}` : "";
  return `HPDG ${match[1]}${label}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)] hover:text-[var(--color-paper-100)]"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
    >
      {copied ? "скопировано" : "копировать"}
    </button>
  );
}

function Outcomes({ outcomes }: { outcomes: IssueOutcome[] }) {
  if (outcomes.length === 0) return null;
  const text = outcomes.filter((o) => o.key).map((o) => `${o.email}\t${o.key}`).join("\n");
  return (
    <div className="space-y-2 border border-[var(--color-line)] p-3">
      <div className="flex items-center justify-between">
        <p className={label}>Результат</p>
        {text ? <CopyButton text={text} /> : null}
      </div>
      {outcomes.map((o) => (
        <p key={`${o.email}-${o.status}`} className="font-mono text-xs text-[var(--color-paper-200)]">
          {o.email} — {o.status === "issued" ? <strong>{o.key}</strong> : `уже есть ключ ${o.key ?? ""}${o.reason === "payment_already_imported" ? " (эта оплата уже импортирована)" : ""}`}
        </p>
      ))}
    </div>
  );
}

function ReleasesSection({ releases, onChange }: { releases: AdminHpdgRelease[]; onChange: (r: AdminHpdgRelease[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [form, setForm] = useState({ version: "", title: "", notes: "", page: "https://hamloprod.org/en/vst", sha256: "", makeCurrent: true });
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const current = releases.find((r) => r.isCurrent);

  const ownerHash = form.sha256.trim().toLowerCase();
  const hashMismatch = Boolean(hash && ownerHash && hash !== ownerHash);

  async function pick(next: File | null) {
    setFile(next); setHash(null); setError(null); setMessage(null);
    if (!next) return;
    const version = versionFromFileName(next.name);
    setForm((f) => ({ ...f, version: version || f.version, title: titleFromVersion(version) || f.title }));
    setHashing(true);
    try { setHash(await sha256Hex(next)); } catch { setError("Не удалось посчитать SHA-256 в браузере."); } finally { setHashing(false); }
  }

  async function publish() {
    if (!file || !hash) return;
    setBusy(true); setError(null); setMessage(null); setProgress(null);
    try {
      const prepared = await call<{ key: string; exists: boolean; upload?: { url: string; headers: Record<string, string> } }>(
        "/api/admin/hpdg/installer-upload-url", "POST", { fileName: file.name, size: file.size },
      );
      if (!prepared.exists && prepared.upload) {
        setProgress(0);
        await putWithProgress(prepared.upload.url, prepared.upload.headers, file, setProgress);
      }
      const saved = await call<{ releases: AdminHpdgRelease[] }>("/api/admin/hpdg/releases", "POST", {
        ...form, sha256: ownerHash || hash, fileName: file.name, size: file.size,
      });
      onChange(saved.releases);
      setMessage(`${prepared.key} ${prepared.exists ? "уже был в хранилище" : "загружен"}, релиз ${form.version} сохранён${form.makeCurrent ? " и опубликован" : ""}.`);
      setFile(null); setHash(null); setProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка.");
    } finally {
      setBusy(false);
    }
  }

  async function makeCurrent(id: string) {
    setError(null);
    try { onChange((await call<{ releases: AdminHpdgRelease[] }>(`/api/admin/hpdg/releases/${id}`, "PATCH")).releases); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка."); }
  }

  return (
    <section className={panel}>
      <div>
        <p className={label}>HPDG / обновления в плагине</p>
        <h2 className="mt-2 font-sans text-3xl uppercase tracking-[0.06em]">Релизы</h2>
        <p className="mt-2 text-sm text-[var(--color-paper-200)]">
          Сейчас плагин видит: {current ? <strong>{current.version}</strong> : <span className="text-[var(--color-alert)]">ничего (кнопка Update покажет «not available yet»)</span>}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className={label}>Установщик (.exe)</span>
          <input type="file" accept=".exe" className={input} disabled={busy} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {file ? (
            <span className={muted}>
              hpdg/{file.name} · {formatSize(file.size)} · SHA-256: {hashing ? "считаю…" : <span className="font-mono">{hash}</span>}
            </span>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className={label}>Версия</span>
          <input className={input} value={form.version} placeholder="0.1.0-beta.4" onChange={(e) => setForm({ ...form, version: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className={label}>Название</span>
          <input className={input} value={form.title} placeholder="HPDG 0.1.0 Beta 4" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>Что нового (до 600 символов, видно в подсказке кнопки)</span>
          <textarea className={input} rows={3} maxLength={600} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>SHA-256 из Get-FileHash (сверяется с файлом)</span>
          <input className={`${input} font-mono`} value={form.sha256} placeholder="64 hex" onChange={(e) => setForm({ ...form, sha256: e.target.value })} />
          {hashMismatch ? <span className={alert}>Не совпадает с файлом — это не тот установщик или он повреждён.</span> : null}
          {hash && ownerHash && !hashMismatch ? <span className={muted}>Совпадает с файлом.</span> : null}
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>Страница HPDG (только hamloprod.org)</span>
          <input className={input} value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-paper-200)]">
          <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={form.makeCurrent} onChange={(e) => setForm({ ...form, makeCurrent: e.target.checked })} />
          Сразу сделать текущим (плагин увидит через ~5 минут)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" disabled={!file || !hash || hashing || busy || hashMismatch || !form.version || !form.title} onClick={publish}>
          {busy ? (progress !== null ? `Загрузка ${progress}%` : "Сохраняю…") : "Загрузить и сохранить"}
        </Button>
        {error ? <span className={alert}>{error}</span> : null}
        {message ? <span className="text-xs text-[var(--color-paper-200)]">{message}</span> : null}
      </div>

      {releases.length > 0 ? (
        <table className="w-full text-left text-sm [&_td]:pr-3 [&_th]:pr-3">
          <thead className={label}>
            <tr><th className="py-2">Версия</th><th>Файл</th><th>Размер</th><th>Добавлен</th><th /></tr>
          </thead>
          <tbody>
            {releases.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-line)]">
                <td className="py-2">{r.version}{r.isCurrent ? <span className="ml-2 text-xs text-amber-400">текущий</span> : null}</td>
                <td className="font-mono text-xs">{r.objectKey}</td>
                <td>{formatSize(r.size)}</td>
                <td>{formatDate(r.createdAt)}</td>
                <td className="text-right">{r.isCurrent ? null : <Button type="button" variant="ghost" onClick={() => makeCurrent(r.id)}>Сделать текущим</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function IssueSection({ onKeys }: { onKeys: (keys: AdminLicenseKey[]) => void }) {
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const [outcomes, setOutcomes] = useState<IssueOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await call<{ outcomes: IssueOutcome[]; keys: AdminLicenseKey[] }>("/api/admin/hpdg/keys", "POST", { emails: list, note });
      setOutcomes(result.outcomes); onKeys(result.keys); setEmails("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка."); }
    finally { setBusy(false); }
  }

  return (
    <section className={panel}>
      <h2 className="font-sans text-3xl uppercase tracking-[0.06em]">Выдать ключ по email</h2>
      <p className={muted}>Один email — один активный ключ. Если ключ уже есть, он будет показан снова (можно переслать покупателю).</p>
      <label className="space-y-1 block">
        <span className={label}>Email (по одному в строке или через запятую)</span>
        <textarea className={input} rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} />
      </label>
      <label className="space-y-1 block">
        <span className={label}>Заметка (необязательно)</span>
        <input className={input} value={note} placeholder="Например: оплата через PayPal 12.10" onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex items-center gap-4">
        <Button type="button" disabled={busy || !emails.trim()} onClick={issue}>{busy ? "Выдаю…" : "Выдать ключи"}</Button>
        {error ? <span className={alert}>{error}</span> : null}
      </div>
      <Outcomes outcomes={outcomes} />
    </section>
  );
}

function StripeImportSection({ keys, onKeys }: { keys: AdminLicenseKey[]; onKeys: (keys: AdminLicenseKey[]) => void }) {
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<IssueOutcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeEmails = useMemo(() => new Set(keys.filter((k) => !k.revokedAt).map((k) => k.email)), [keys]);
  const importedPayments = useMemo(() => new Set(keys.map((k) => k.stripePaymentId).filter(Boolean)), [keys]);

  async function load(file: File | null) {
    setOutcomes([]); setError(null);
    if (!file) return;
    const { payments: parsed, error: problem } = parseStripePayments(await file.text());
    setParseError(problem);
    setPayments(parsed);
    setSelected(new Set(parsed.filter((p) => p.eligible && !activeEmails.has(p.email) && !importedPayments.has(p.paymentId)).map((p) => p.paymentId)));
  }

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  async function issue() {
    const chosen = payments.filter((p) => selected.has(p.paymentId));
    if (chosen.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await call<{ outcomes: IssueOutcome[]; keys: AdminLicenseKey[] }>("/api/admin/hpdg/keys", "POST", {
        payments: chosen.map((p) => ({ email: p.email, paymentId: p.paymentId, customerId: p.customerId })),
        note: "Stripe CSV import",
      });
      setOutcomes(result.outcomes); onKeys(result.keys); setSelected(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка."); }
    finally { setBusy(false); }
  }

  return (
    <section className={panel}>
      <h2 className="font-sans text-3xl uppercase tracking-[0.06em]">Ключи по оплатам Stripe</h2>
      <p className={muted}>
        Stripe Dashboard → Payments → Export → CSV (нужны колонки id, Status и email покупателя). Файл читается только в браузере;
        на сервер уходят лишь выбранные email и id оплат. Каждая оплата импортируется один раз.
      </p>
      <input type="file" accept=".csv,text/csv" className={input} onChange={(e) => load(e.target.files?.[0] ?? null)} />
      {parseError ? <p className={alert}>{parseError}</p> : null}
      {payments.length > 0 ? (
        <>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs [&_td]:pr-3 [&_th]:pr-3">
              <thead className={label}>
                <tr><th className="py-2" /><th>Email</th><th>Сумма</th><th>Дата</th><th>Описание</th><th>Статус</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const hasKey = activeEmails.has(p.email) || importedPayments.has(p.paymentId);
                  return (
                    <tr key={p.paymentId || p.email} className="border-t border-[var(--color-line)]">
                      <td className="py-1"><input type="checkbox" className="h-4 w-4 accent-amber-500" disabled={!p.eligible} checked={selected.has(p.paymentId)} onChange={() => toggle(p.paymentId)} /></td>
                      <td>{p.email || "—"}</td>
                      <td>{p.amount} {p.currency}</td>
                      <td>{p.created}</td>
                      <td className="max-w-48 truncate">{p.description}</td>
                      <td className={p.eligible ? "" : "text-[var(--color-paper-500)]"}>{p.eligible ? (hasKey ? "уже есть ключ" : "оплачено") : p.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4">
            <Button type="button" disabled={busy || selected.size === 0} onClick={issue}>{busy ? "Выдаю…" : `Выдать ключи (${selected.size})`}</Button>
            {error ? <span className={alert}>{error}</span> : null}
          </div>
        </>
      ) : null}
      <Outcomes outcomes={outcomes} />
    </section>
  );
}

function KeysTable({ keys, onKeys }: { keys: AdminLicenseKey[]; onKeys: (keys: AdminLicenseKey[]) => void }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const visible = keys.filter((k) => !query || k.email.includes(query.toLowerCase()) || k.key.includes(query.toUpperCase()));

  async function setRevoked(key: AdminLicenseKey, revoked: boolean) {
    const reason = revoked ? window.prompt(`Отозвать ключ ${key.key} (${key.email})? Причина:`, "refund") : null;
    if (revoked && reason === null) return;
    setError(null);
    try { onKeys((await call<{ keys: AdminLicenseKey[] }>(`/api/admin/hpdg/keys/${key.id}`, "PATCH", { revoked, reason })).keys); }
    catch (e) { setError(e instanceof Error ? e.message : "Ошибка."); }
  }

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-sans text-3xl uppercase tracking-[0.06em]">Ключи ({keys.filter((k) => !k.revokedAt).length} активных)</h2>
        <input className={`${input} max-w-xs`} placeholder="Поиск: email или ключ" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {error ? <p className={alert}>{error}</p> : null}
      <div className="overflow-auto">
        <table className="w-full text-left text-xs [&_td]:pr-3 [&_th]:pr-3">
          <thead className={label}>
            <tr><th className="py-2">Ключ</th><th>Email</th><th>Откуда</th><th>Выдан</th><th>Скачиваний (24 ч / всего)</th><th>Последнее</th><th /></tr>
          </thead>
          <tbody>
            {visible.map((k) => (
              <tr key={k.id} className={`border-t border-[var(--color-line)] ${k.revokedAt ? "opacity-50" : ""}`}>
                <td className="whitespace-nowrap py-2 font-mono">{k.key} <CopyButton text={k.key} /></td>
                <td>{k.email}{k.note ? <span className="block text-[var(--color-paper-500)]">{k.note}</span> : null}</td>
                <td>{k.source}</td>
                <td>{formatDate(k.createdAt)}</td>
                <td>{k.downloads24h} / {k.downloads}</td>
                <td>{k.lastDownloadAt ? `${formatDate(k.lastDownloadAt)} · ${k.lastVersion}` : "—"}</td>
                <td className="text-right">
                  {k.revokedAt ? (
                    <span className="space-x-3">
                      <span className="text-[var(--color-alert)]">отозван{k.revokedReason ? `: ${k.revokedReason}` : ""}</span>
                      <button type="button" className="uppercase tracking-[0.16em] text-[var(--color-paper-400)] hover:text-[var(--color-paper-100)]" onClick={() => setRevoked(k, false)}>вернуть</button>
                    </span>
                  ) : (
                    <button type="button" className="uppercase tracking-[0.16em] text-[var(--color-paper-400)] hover:text-[var(--color-alert)]" onClick={() => setRevoked(k, true)}>отозвать</button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? <tr><td colSpan={7} className={`py-4 ${muted}`}>Ключей пока нет.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminHpdgManager({ initialReleases, initialKeys }: { initialReleases: AdminHpdgRelease[]; initialKeys: AdminLicenseKey[] }) {
  const [releases, setReleases] = useState(initialReleases);
  const [keys, setKeys] = useState(initialKeys);
  return (
    <div className="space-y-6">
      <ReleasesSection releases={releases} onChange={setReleases} />
      <IssueSection onKeys={setKeys} />
      <StripeImportSection keys={keys} onKeys={setKeys} />
      <KeysTable keys={keys} onKeys={setKeys} />
    </div>
  );
}
