"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./hpdg808-download.module.css";

export function Hpdg808Download({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const isRu = locale === "ru";
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function download(email?: string) {
    if (pending) return;
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/hpdg808/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (!response.ok) throw new Error("download_failed");
      const data: { url: string; emailSaved: boolean } = await response.json();
      if (email && !data.emailSaved) {
        setError(isRu ? "Не удалось сохранить email. Скачивание началось, адрес можно отправить ещё раз позже." : "We could not save your email. Your download has started; you can try leaving your email again later.");
      } else {
        dialogRef.current?.close();
      }
      window.location.assign(data.url);
    } catch {
      setError(isRu ? "Не удалось начать скачивание. Попробуй ещё раз чуть позже." : "We could not start the download. Please try again shortly.");
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    void download(value || undefined);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => { setError(""); dialogRef.current?.showModal(); }}>
        {label}<span aria-hidden="true">↓</span>
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()} aria-label={isRu ? "Закрыть" : "Close"}>×</button>
        <p className={styles.eyebrow}>HPDG 808 / FREE DOWNLOAD</p>
        <h2 id={`${id}-title`}>{isRu ? "Оставишь email?" : "Leave your email?"}</h2>
        <p id={`${id}-description`}>{isRu ? "По желанию — сохраним адрес для связи по HPDG 808. Или просто скачай без email." : "Only if you like: we will keep your address for contact about HPDG 808. Or just download without an email."}</p>
        <form onSubmit={submit}>
          <label htmlFor={`${id}-email`}>Email <span>{isRu ? "(необязательно)" : "(optional)"}</span></label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} disabled={pending} />
          <button type="submit" className={styles.primary} disabled={pending}>{pending ? (isRu ? "Готовим скачивание…" : "Preparing download…") : (isRu ? "Скачать бесплатно" : "Download free")}</button>
          <button type="button" className={styles.skip} onClick={() => void download()} disabled={pending}>{isRu ? "Скачать без email" : "Download without email"}</button>
          <p className={styles.note}>{isRu ? "Без регистрации, оплаты и ключа активации." : "No account, payment or activation key."}</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </form>
      </dialog>
    </>
  );
}
