"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BeatDownloadButton({
  beatId,
  beatSlug,
  isAuthenticated,
  hasDownloadFiles,
  availableForDownload,
}: {
  beatId: string;
  beatSlug: string;
  isAuthenticated: boolean;
  hasDownloadFiles: boolean;
  availableForDownload: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isAvailable = hasDownloadFiles && availableForDownload;

  const buttonLabel = !isAvailable
    ? "Assets Unavailable"
    : !isAuthenticated
      ? "Login For Files"
      : isLoading
        ? "Preparing"
        : "Download Files";

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        disabled={isLoading || !isAvailable}
        onClick={async () => {
          if (!isAvailable) {
            setStatusMessage("Для этого бита пока не загружены WAV/ZIP файлы.");
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
              setStatusMessage(payload?.error ?? "Не удалось подготовить скачивание.");
              return;
            }

            window.location.href = payload.url;
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
