"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dictionary, type Locale } from "@/lib/i18n";

export function BeatDownloadButton({
  beatId,
  beatSlug,
  isAuthenticated,
  availableForDownload,
  locale,
}: {
  beatId: string;
  beatSlug: string;
  isAuthenticated: boolean;
  availableForDownload: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const t = dictionary[locale];

  const isAvailable = availableForDownload;

  const buttonLabel = !isAvailable ? t.mp3Unavailable : !isAuthenticated ? t.loginForMp3 : isLoading ? t.preparing : t.downloadMp3;

  const startBrowserDownload = async (url: string, fileName: string) => {
    try {
      const fileResponse = await fetch(url);
      if (!fileResponse.ok) {
        throw new Error("Failed to fetch file.");
      }

      const blob = await fileResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.location.assign(url);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        disabled={isLoading || !isAvailable}
        onClick={async () => {
          if (!isAvailable) {
            setStatusMessage(locale === "ru" ? "Скачивание MP3 для этого бита отключено администратором." : "MP3 download is disabled by admin for this beat.");
            return;
          }

          if (!isAuthenticated) {
            router.push(`/auth?next=/beats/${beatSlug}`);
            return;
          }

          setIsLoading(true);
          setStatusMessage(null);

          try {
            const response = await fetch(`/api/beats/${beatId}/download`, { method: "POST" });
            const payload = (await response.json().catch(() => null)) as { error?: string; url?: string; format?: string } | null;

            if (!response.ok || !payload?.url) {
              setStatusMessage(payload?.error ?? (locale === "ru" ? "Не удалось подготовить скачивание." : "Failed to prepare download."));
              return;
            }

            await startBrowserDownload(payload.url, `${beatSlug}.mp3`);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        {buttonLabel}
      </Button>

      {statusMessage ? <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{statusMessage}</span> : null}
    </div>
  );
}
