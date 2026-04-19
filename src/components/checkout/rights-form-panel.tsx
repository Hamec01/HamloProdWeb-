"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  orderId: string;
  locale: "ru" | "en";
  defaultFullName: string;
  defaultCity: string;
  defaultStageName: string;
};

type Mode = "deferred" | "partial";

type Payload = {
  contractUrl?: string;
  error?: string;
};

const copy = {
  ru: {
    title: "Форма отчуждения прав",
    deferred: "Заполнить позже",
    now: "Заполнить сейчас",
    fullName: "ФИО",
    city: "Город",
    stageName: "Псевдоним артиста",
    submitDeferred: "Сформировать шаблон PDF",
    submitNow: "Сформировать PDF с заполненными полями",
    success: "PDF готов. Откройте документ по ссылке ниже.",
    open: "Открыть PDF",
    invalid: "Заполните ФИО, город и псевдоним артиста.",
    failed: "Не удалось сформировать PDF. Попробуйте ещё раз.",
  },
  en: {
    title: "Exclusive Rights Transfer Form",
    deferred: "Fill Later",
    now: "Fill Now",
    fullName: "Full Name",
    city: "City",
    stageName: "Artist Stage Name",
    submitDeferred: "Generate PDF Template",
    submitNow: "Generate PDF",
    success: "PDF is ready. Open it with the link below.",
    open: "Open PDF",
    invalid: "Please fill full name, city and stage name.",
    failed: "Failed to generate PDF. Try again.",
  },
};

export function RightsFormPanel({ orderId, locale, defaultFullName, defaultCity, defaultStageName }: Props) {
  const t = copy[locale];
  const [mode, setMode] = useState<Mode>("deferred");
  const [isLoading, setIsLoading] = useState(false);
  const [fullName, setFullName] = useState(defaultFullName);
  const [city, setCity] = useState(defaultCity);
  const [stageName, setStageName] = useState(defaultStageName);
  const [error, setError] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);

  const submitLabel = useMemo(() => {
    return mode === "deferred" ? t.submitDeferred : t.submitNow;
  }, [mode, t.submitDeferred, t.submitNow]);

  async function onSubmit() {
    setIsLoading(true);
    setError(null);
    setContractUrl(null);

    if (mode === "partial") {
      if (!fullName.trim() || !city.trim() || !stageName.trim()) {
        setError(t.invalid);
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/contracts/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          mode,
          buyerFullName: mode === "partial" ? fullName : undefined,
          buyerCity: mode === "partial" ? city : undefined,
          buyerStageName: mode === "partial" ? stageName : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as Payload | null;

      if (!response.ok || !payload?.contractUrl) {
        setError(payload?.error ?? t.failed);
        setIsLoading(false);
        return;
      }

      setContractUrl(payload.contractUrl);
    } catch {
      setError(t.failed);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.8)] p-6">
      <h2 className="text-sm uppercase tracking-[0.22em] text-[var(--color-paper-100)]">{t.title}</h2>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={mode === "deferred" ? "primary" : "ghost"}
          onClick={() => setMode("deferred")}
          disabled={isLoading}
        >
          {t.deferred}
        </Button>
        <Button
          type="button"
          variant={mode === "partial" ? "primary" : "ghost"}
          onClick={() => setMode("partial")}
          disabled={isLoading}
        >
          {t.now}
        </Button>
      </div>

      {mode === "partial" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            {t.fullName}
            <input
              className="w-full rounded border border-[var(--color-line)] bg-[rgba(0,0,0,0.24)] px-3 py-2 text-sm text-[var(--color-paper-100)] outline-none"
              value={fullName}
              onChange={(event) => setFullName(event.currentTarget.value)}
            />
          </label>
          <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            {t.city}
            <input
              className="w-full rounded border border-[var(--color-line)] bg-[rgba(0,0,0,0.24)] px-3 py-2 text-sm text-[var(--color-paper-100)] outline-none"
              value={city}
              onChange={(event) => setCity(event.currentTarget.value)}
            />
          </label>
          <label className="space-y-2 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            {t.stageName}
            <input
              className="w-full rounded border border-[var(--color-line)] bg-[rgba(0,0,0,0.24)] px-3 py-2 text-sm text-[var(--color-paper-100)] outline-none"
              value={stageName}
              onChange={(event) => setStageName(event.currentTarget.value)}
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {contractUrl ? (
        <div className="space-y-2 text-sm text-[var(--color-paper-200)]">
          <p>{t.success}</p>
          <a href={contractUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted">
            {t.open}
          </a>
        </div>
      ) : null}

      <Button type="button" onClick={() => void onSubmit()} disabled={isLoading}>
        {isLoading ? "..." : submitLabel}
      </Button>
    </section>
  );
}
