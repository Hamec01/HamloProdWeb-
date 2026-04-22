"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";

export function TrackDownloadButton({
  trackId,
  isAuthenticated,
  isAvailable,
  locale,
  size = "normal",
}: {
  trackId: string;
  isAuthenticated: boolean;
  isAvailable: boolean;
  locale: Locale;
  size?: "normal" | "small";
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const t = dictionary[locale];

  const buttonLabel = !isAvailable ? t.mp3Unavailable : !isAuthenticated ? t.loginForMp3 : isLoading ? t.preparing : t.downloadMp3;

  const startBrowserDownload = async (url: string) => {
    try {
      const fileResponse = await fetch(url);
      if (!fileResponse.ok) {
        throw new Error("Failed to fetch file.");
      }

      const blob = await fileResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "track.mp3";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.location.assign(url);
    }
  };

  const handleClick = async () => {
    if (!isAvailable) {
      setStatusMessage(locale === "ru" ? "Для этого релиза бесплатный MP3 ещё не загружен." : "Free MP3 is not uploaded for this release yet.");
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth?next=/tracks`);
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/tracks/${trackId}/download`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        setStatusMessage(payload?.error ?? (locale === "ru" ? "Не удалось подготовить скачивание." : "Failed to prepare download."));
        return;
      }

      await startBrowserDownload(payload.url);
    } finally {
      setIsLoading(false);
    }
  };

  if (size === "small") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || !isAvailable}
        className="flex h-8 w-8 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        {isLoading ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <Download size={12} />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        disabled={isLoading || !isAvailable}
        onClick={handleClick}
      >
        {buttonLabel}
      </Button>
      {statusMessage ? <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{statusMessage}</span> : null}
    </div>
  );
}