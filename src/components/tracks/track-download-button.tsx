"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TrackDownloadButton({ trackId, isAuthenticated }: { trackId: string; isAuthenticated: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={isLoading}
      onClick={async () => {
        if (!isAuthenticated) {
          router.push(`/auth?next=/tracks`);
          return;
        }

        setIsLoading(true);

        try {
          const response = await fetch(`/api/tracks/${trackId}/download`, { method: "POST" });
          const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

          if (!response.ok || !payload?.url) {
            router.refresh();
            return;
          }

          window.location.href = payload.url;
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? "Preparing" : "Free MP3"}
    </Button>
  );
}