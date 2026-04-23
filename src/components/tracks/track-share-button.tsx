"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function TrackShareButton({
  trackSlug,
  releaseSlug,
  locale,
  size = "default",
}: {
  trackSlug: string;
  releaseSlug: string;
  locale: Locale;
  size?: "default" | "small";
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${baseUrl}/${locale}/tracks/${releaseSlug}?track=${trackSlug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: show alert
      alert(shareUrl);
    }
  };

  const sizeClass = size === "small" ? "h-7 w-7" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={handleShare}
      title={locale === "ru" ? "Копировать ссылку на трек" : "Copy track link"}
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
