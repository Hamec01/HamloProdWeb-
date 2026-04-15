"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Locale } from "@/lib/i18n";

type ReactionStats = {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
};

export function BeatReactionBar({ beatId, locale }: { beatId: string; locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stats, setStats] = useState<ReactionStats>({ likes: 0, dislikes: 0, userReaction: null });
  const [isLoading, setIsLoading] = useState(false);

  const copy = useMemo(
    () =>
      locale === "ru"
        ? {
            title: "Лайк / дизлайк",
            hint: "Один голос на бит для одного пользователя.",
          }
        : {
            title: "Like / dislike",
            hint: "One vote per beat per user.",
          },
    [locale],
  );

  const load = useCallback(async () => {
    const response = await fetch(`/api/beats/${beatId}/reaction`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as ReactionStats | null;
    if (response.ok && payload) {
      setStats(payload);
    }
  }, [beatId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReaction = async (reaction: "like" | "dislike") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/beats/${beatId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });

      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(pathname || "/beats")}`);
        return;
      }

      const payload = (await response.json().catch(() => null)) as ReactionStats | null;
      if (response.ok && payload) {
        setStats(payload);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{copy.title}</p>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
        <button
          type="button"
          onClick={() => void submitReaction("like")}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 border px-3 py-1 transition-colors disabled:opacity-60 ${
            stats.userReaction === "like"
              ? "border-[var(--color-gold)] text-[var(--color-paper-100)]"
              : "border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.04)]"
          }`}
        >
          <ThumbsUp size={12} /> {stats.likes}
        </button>

        <button
          type="button"
          onClick={() => void submitReaction("dislike")}
          disabled={isLoading}
          className={`inline-flex items-center gap-2 border px-3 py-1 transition-colors disabled:opacity-60 ${
            stats.userReaction === "dislike"
              ? "border-[var(--color-alert)] text-[var(--color-paper-100)]"
              : "border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.04)]"
          }`}
        >
          <ThumbsDown size={12} /> {stats.dislikes}
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{copy.hint}</p>
    </div>
  );
}
