"use client";

import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n";

export function TrackFavoriteButton({
  trackId,
  isAuthenticated,
  locale,
  size = "default",
}: {
  trackId: string;
  isAuthenticated: boolean;
  locale: Locale;
  size?: "default" | "small";
}) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchFavoriteStatus = async () => {
      try {
        const res = await fetch("/api/favorites");
        const data = (await res.json()) as { favorites?: string[] };
        setIsFavorite(data.favorites?.includes(trackId) ?? false);
      } catch {
        // Ignore errors
      }
    };

    void fetchFavoriteStatus();
  }, [trackId, isAuthenticated]);

  const handleToggle = async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, isFavorite: !isFavorite }),
      });

      if (res.ok) {
        const nextIsFavorite = !isFavorite;
        setIsFavorite(nextIsFavorite);
        window.dispatchEvent(
          new CustomEvent("favorites:changed", {
            detail: { trackId, isFavorite: nextIsFavorite },
          }),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClass = size === "small" ? "h-7 w-7" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!isAuthenticated || isLoading}
      title={locale === "ru" ? (isFavorite ? "Убрать из понравившихся" : "Добавить в понравившихся") : isFavorite ? "Remove from favorites" : "Add to favorites"}
      className={`flex ${sizeClass} items-center justify-center border border-[var(--color-line)] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        isFavorite
          ? "border-amber-500 text-amber-500 bg-[rgba(217,119,6,0.1)]"
          : "border-[var(--color-line)] text-[var(--color-paper-400)] hover:border-amber-500 hover:text-amber-500"
      }`}
    >
      <Heart size={size === "small" ? 12 : 14} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
