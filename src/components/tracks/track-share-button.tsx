"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function TrackShareButton({
  trackSlug,
  trackId,
  releaseSlug,
  locale,
  size = "default",
}: {
  trackSlug: string;
  trackId?: string;
  releaseSlug: string;
  locale: Locale;
  size?: "default" | "small";
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const sharePath = `/${locale}/tracks/${releaseSlug}`;
    const url = new URL(sharePath, window.location.origin);
    url.searchParams.set("track", trackSlug || "");
    if (trackId) {
      url.searchParams.set("trackId", trackId);
    }
    const shareUrl = url.toString();

    // Open track page immediately while click gesture is active.
    window.open(shareUrl, "_blank", "noopener,noreferrer");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement("input");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(locale === "ru" ? "Скопируй ссылку:" : "Copy link:", shareUrl);
    }
  };

  const sizeClass = size === "small" ? "h-7 w-7" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={handleShare}
      title={locale === "ru" ? "Открыть трек и скопировать ссылку" : "Open track and copy link"}
      className={`flex ${sizeClass} items-center justify-center border transition-colors ${
        copied
          ? "border-amber-500 text-amber-500 bg-[rgba(217,119,6,0.1)]"
          : "border-[var(--color-line)] text-[var(--color-paper-400)] hover:border-amber-500 hover:text-amber-500"
      }`}
    >
      <Share2 size={size === "small" ? 12 : 14} />
    </button>
  );
}
