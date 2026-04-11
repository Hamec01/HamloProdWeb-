"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TrackDownloadButton({
  trackId,
  isAuthenticated,
  isAvailable,
}: {
  trackId: string;
  isAuthenticated: boolean;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const buttonLabel = !isAvailable ? "MP3 Unavailable" : !isAuthenticated ? "Login For MP3" : isLoading ? "Preparing" : "Free MP3";

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        disabled={isLoading || !isAvailable}
        onClick={async () => {
          if (!isAvailable) {
            setStatusMessage("Для этого релиза бесплатный MP3 ещё не загружен.");
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