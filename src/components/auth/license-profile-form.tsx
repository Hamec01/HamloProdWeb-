"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LicenseProfileDetails } from "@/lib/account/license-profile";

export function LicenseProfileForm({ initial, locale }: { initial: LicenseProfileDetails; locale: "ru" | "en" }) {
  const [details, setDetails] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter(), ru = locale === "ru";
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/license-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setMessage(ru ? "Данные сохранены. Они будут подставляться при покупке бита." : "Saved. These details will prefill your next beat purchase."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : (ru ? "Не удалось сохранить." : "Could not save.")); }
    finally { setBusy(false); }
  }
  const fields: { name: keyof LicenseProfileDetails; label: string; max: number; auto: string; optional?: boolean }[] = [
    { name: "fullName", label: ru ? "Имя и фамилия для лицензии" : "Full name for the license", max: 180, auto: "name" },
    { name: "stageName", label: ru ? "Рэп-псевдоним / имя артиста (необязательно)" : "Artist name (optional)", max: 120, auto: "nickname", optional: true },
    { name: "email", label: "Email", max: 320, auto: "email" },
    { name: "country", label: ru ? "Страна" : "Country", max: 120, auto: "country-name" },
    { name: "city", label: ru ? "Город" : "City", max: 120, auto: "address-level2" },
    { name: "phone", label: ru ? "Телефон (необязательно)" : "Phone (optional)", max: 40, auto: "tel", optional: true },
  ];
  return <section className="case-panel space-y-5 p-5 sm:p-6">
    <h2 className="text-2xl">{ru ? "Данные для лицензии" : "License details"}</h2>
    <p className="text-sm text-stone-300">{ru ? "Заполните один раз — эти данные появятся в форме покупки. Согласие с договором подтверждается отдельно для каждого бита. Паспортные данные не нужны." : "Save your details once to prefill purchases. You accept the agreement separately for each beat. No passport details are needed."}</p>
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(({ name, label, max, auto, optional }) => <label key={name} className="block space-y-2 text-sm"><span>{label}</span><input name={name} autoComplete={auto} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} maxLength={max} required={!optional} value={details[name]} onChange={(event) => { setDetails((previous) => ({ ...previous, [name]: event.target.value })); setMessage(""); }} className="w-full border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" /></label>)}</div>
      <button disabled={busy} type="submit" className="border border-amber-700 bg-amber-950/20 px-4 py-3 text-sm disabled:opacity-50">{busy ? (ru ? "Сохраняем…" : "Saving…") : ru ? "Сохранить данные" : "Save details"}</button>
      {message ? <p role="status" className="text-sm text-amber-200">{message}</p> : null}
    </form>
  </section>;
}
