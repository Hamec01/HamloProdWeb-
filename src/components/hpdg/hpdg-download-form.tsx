"use client";

import { useState, type FormEvent } from "react";
import { downloadCopy, downloadErrorMessage, isInstallerUrl, type DownloadLocale } from "@/lib/hpdg/download-page";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; message: string }
  | { kind: "started"; url: string; version: string; size: number };

export function HpdgDownloadForm({ locale }: { locale: DownloadLocale }) {
  const copy = downloadCopy[locale];
  const [key, setKey] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    setState({ kind: "working" });
    try {
      const response = await fetch("/api/hpdg/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key, platform: "windows-x64" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !isInstallerUrl(data.url)) {
        setState({ kind: "error", message: downloadErrorMessage(response.ok ? 500 : response.status, locale) });
        return;
      }
      setState({ kind: "started", url: data.url, version: String(data.version), size: Number(data.size) });
      window.location.assign(data.url);
    } catch {
      setState({ kind: "error", message: downloadErrorMessage(0, locale) });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">{copy.keyLabel}</span>
        <input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="HPDG-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="w-full border border-[var(--color-line)] bg-transparent px-3 py-3 font-mono text-base uppercase tracking-[0.04em] sm:px-4 sm:text-lg sm:tracking-[0.12em] text-[var(--color-paper-100)] focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={state.kind === "working" || !key.trim()}
        className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-5 py-3 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.kind === "working" ? copy.working : copy.submit}
      </button>
      {state.kind === "error" ? <p role="alert" className="text-sm text-[var(--color-alert)]">{state.message}</p> : null}
      {state.kind === "started" ? (
        <div role="status" className="space-y-1 text-sm text-[var(--color-paper-200)]">
          <p>
            {copy.started} HPDG {state.version} ({(state.size / 1024 / 1024).toFixed(1)} MB).{" "}
            <a href={state.url} className="underline">{copy.manual}</a>.
          </p>
          <p className="text-xs text-[var(--color-paper-400)]">{copy.linkExpires}</p>
        </div>
      ) : null}
    </form>
  );
}
