"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type ReactionStats = {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
};

export function BeatLikeButton({
  beatId,
  isAuthenticated,
  locale,
  size = "default",
}: {
  beatId: string;
  isAuthenticated: boolean;
  locale: Locale;
  size?: "default" | "small";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [stats, setStats] = useState<ReactionStats>({ likes: 0, dislikes: 0, userReaction: null });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/beats/${beatId}/reaction`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ReactionStats | null;
      if (response.ok && payload) {
        setStats(payload);
      }
    };

    void load();
  }, [beatId]);

  const handleLike = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/beats")}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/beats/${beatId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: "like" }),
      });

      const payload = (await response.json().catch(() => null)) as ReactionStats | null;
      if (response.ok && payload) {
        setStats(payload);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLiked = stats.userReaction === "like";
  const sizeClass = size === "small" ? "h-7 w-7" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={() => void handleLike()}
      disabled={isLoading}
      title={locale === "ru" ? "Лайк" : "Like"}
      className={`inline-flex ${sizeClass} items-center justify-center gap-1.5 border px-2 text-[11px] uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isLiked
          ? "border-amber-500 bg-[rgba(217,119,6,0.12)] text-amber-400"
          : "border-[var(--color-line)] text-[var(--color-paper-300)] hover:border-amber-500 hover:text-amber-400"
      }`}
    >
      <Heart size={size === "small" ? 12 : 13} fill={isLiked ? "currentColor" : "none"} />
      <span>{stats.likes}</span>
    </button>
  );
}
