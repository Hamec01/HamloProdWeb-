"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LicenseSellerInput } from "@/lib/validations/license-seller";

type Props = { identity: LicenseSellerInput };
const fields = [
  ["seller_name", "ФИО правообладателя", true],
  ["seller_alias", "Псевдоним", true],
  ["seller_country", "Страна", true],
  ["seller_city", "Город", true],
  ["seller_email", "Email", true],
  ["seller_phone", "Телефон", false],
  ["seller_telegram", "Telegram", false],
  ["seller_address", "Адрес (необязательно)", false],
  ["seller_passport", "Документ (необязательно)", false],
  ["seller_payment_requisites", "Платёжные реквизиты (необязательно)", false],
] as const;

export function LicenseSellerForm({ identity }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      let signature = identity.seller_signature_image;
      const file = form.get("signature");
      if (file instanceof File && file.size) {
        if (file.size > 500_000 || !["image/png", "image/jpeg"].includes(file.type)) {
          setMessage("Выберите подпись PNG или JPEG размером до 500 КБ.");
          return;
        }
        signature = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("SIGNATURE_READ_FAILED"));
          reader.readAsDataURL(file);
        });
      }
      const payload = { ...Object.fromEntries(fields.map(([key]) => [key, String(form.get(key) || "")])), seller_signature_image: signature };
      const response = await fetch("/api/admin/licenses/seller", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error || "Не удалось сохранить настройки."); return; }
      setMessage("Сохранено. Эти данные и подпись будут подставляться в новые лицензии.");
      router.refresh();
    } catch { setMessage("Не удалось сохранить настройки. Повторите попытку."); }
    finally { setBusy(false); }
  }

  return <section className="case-panel p-6">
    <h2 className="font-sans text-3xl uppercase tracking-[0.05em]">Данные продавца</h2>
    <p className="mt-3 text-sm text-[var(--color-paper-200)]">Подставляются автоматически. Начальные данные и подпись взяты из LICENSEMAKER. Изменения применяются к новым договорам.</p>
    <form onSubmit={save} className="mt-6 space-y-5">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        {fields.map(([key, label, required]) => <label key={key} className="space-y-2 text-xs uppercase tracking-[0.12em] text-[var(--color-paper-300)]">
          <span>{label}</span>
          <input name={key} defaultValue={identity[key]} required={required} type={key === "seller_email" ? "email" : "text"}
            className="w-full border border-[var(--color-line)] bg-black/25 px-3 py-2 text-sm text-[var(--color-paper-100)]" />
        </label>)}
        <label className="space-y-2 text-sm text-[var(--color-paper-300)] sm:col-span-2">
          <span>Заменить подпись (PNG / JPEG, до 500 КБ)</span>
          <input className="block w-full" type="file" name="signature" accept="image/png,image/jpeg" />
        </label>
      </fieldset>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <button type="submit" disabled={busy} className="border border-[var(--color-line)] px-5 py-3 text-sm uppercase tracking-[0.12em] disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить данные продавца"}</button>
    </form>
  </section>;
}
