"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function BeatShareButton({
  beatSlug,
  beatTitle,
  locale,
  size = "default",
}: {
  beatSlug: string;
  beatTitle: string;
  locale: Locale;
  size?: "default" | "small";
}) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2000);
  };

  const handleShare = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(`/beats/${beatSlug}`, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: beatTitle,
          url,
        });
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(locale === "ru" ? "Ссылка скопирована" : "Link copied");
      }
    } catch {
      try {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
        showToast(locale === "ru" ? "Ссылка скопирована" : "Link copied");
      } catch {
        showToast(locale === "ru" ? "Не удалось скопировать" : "Copy failed");
      }
    }
  };

  const sizeClass = size === "small" ? "h-7 w-7" : "h-9 w-9";

  return (
    <>
      <button
        type="button"
        onClick={() => void handleShare()}
        title={locale === "ru" ? "Поделиться" : "Share"}
        className={`flex ${sizeClass} items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-400)] transition-colors hover:border-amber-500 hover:text-amber-400`}
      >
        <Share2 size={size === "small" ? 12 : 14} />
      </button>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 border border-[var(--color-line)] bg-[rgba(12,11,9,0.95)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-paper-100)] shadow-[0_10px_28px_rgba(0,0,0,0.35)] sm:bottom-6">
          {toastMessage}
        </div>
      ) : null}
    </>
  );
}
