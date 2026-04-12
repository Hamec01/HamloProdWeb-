"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";

type FeedbackComment = {
  id: string;
  comment: string;
  userEmail: string;
  createdAt: string;
};

type FeedbackPayload = {
  averageRating: number;
  ratingsCount: number;
  userRating: number | null;
  comments: FeedbackComment[];
};

function starsFromAverage(value: number) {
  return Math.round(value * 10) / 10;
}

export function ContentFeedbackCard({
  entity,
  contentId,
  isAuthenticated,
  locale,
}: {
  entity: "beats" | "tracks";
  contentId: string;
  isAuthenticated: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [feedback, setFeedback] = useState<FeedbackPayload>({ averageRating: 0, ratingsCount: 0, userRating: null, comments: [] });

  const copy = useMemo(
    () =>
      locale === "ru"
        ? {
            title: "Оценка и комментарии",
            loginPrompt: "Чтобы оценить или комментировать, войди в аккаунт.",
            noComments: "Комментариев пока нет.",
            yourRating: "Твоя оценка",
            submitComment: "Отправить",
            commentPlaceholder: "Напиши комментарий...",
            ratingSaved: "Оценка сохранена.",
            commentSaved: "Комментарий добавлен.",
            failedLoad: "Не удалось загрузить отзывы.",
            failedSave: "Не удалось сохранить.",
          }
        : {
            title: "Rating & comments",
            loginPrompt: "Sign in to rate and comment.",
            noComments: "No comments yet.",
            yourRating: "Your rating",
            submitComment: "Send",
            commentPlaceholder: "Write a comment...",
            ratingSaved: "Rating saved.",
            commentSaved: "Comment added.",
            failedLoad: "Failed to load feedback.",
            failedSave: "Failed to save.",
          },
    [locale],
  );

  const loadFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/feedback/${entity}/${contentId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as FeedbackPayload | null;
      if (!response.ok || !payload) {
        setStatusMessage(copy.failedLoad);
        return;
      }
      setFeedback(payload);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFeedback();
  }, [contentId, entity]);

  const submitRating = async (rating: number) => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/feedback/${entity}/${contentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(payload?.error ?? copy.failedSave);
        return;
      }

      setStatusMessage(copy.ratingSaved);
      await loadFeedback();
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitComment = async () => {
    const comment = commentInput.trim();
    if (!comment) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/feedback/${entity}/${contentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatusMessage(payload?.error ?? copy.failedSave);
        return;
      }

      setCommentInput("");
      setStatusMessage(copy.commentSaved);
      await loadFeedback();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{copy.title}</p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;
            const active = (feedback.userRating ?? 0) >= value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => void submitRating(value)}
                disabled={isSubmitting}
                className="transition-opacity hover:opacity-80 disabled:opacity-50"
                aria-label={`Rate ${value}`}
              >
                <Star size={14} className={active ? "fill-[var(--color-gold)] text-[var(--color-gold)]" : "text-[var(--color-paper-400)]"} />
              </button>
            );
          })}
        </div>
        <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
          {isLoading ? "..." : `${starsFromAverage(feedback.averageRating)} / 5 (${feedback.ratingsCount})`}
        </span>
      </div>

      {feedback.userRating ? (
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-paper-400)]">
          {copy.yourRating}: {feedback.userRating}/5
        </p>
      ) : null}

      <div className="space-y-2">
        {feedback.comments.length ? (
          feedback.comments.slice(0, 3).map((comment) => (
            <div key={comment.id} className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs leading-6 text-[var(--color-paper-200)]">
              <p>{comment.comment}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{comment.userEmail}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-[var(--color-paper-400)]">{copy.noComments}</p>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          value={commentInput}
          onChange={(event) => setCommentInput(event.target.value)}
          placeholder={copy.commentPlaceholder}
          rows={2}
          className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--color-paper-200)]"
        />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => void submitComment()} disabled={isSubmitting || commentInput.trim().length < 2}>
            {copy.submitComment}
          </Button>
          {!isAuthenticated ? <span className="text-[11px] text-[var(--color-paper-400)]">{copy.loginPrompt}</span> : null}
        </div>
      </div>

      {statusMessage ? <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-paper-400)]">{statusMessage}</p> : null}
    </div>
  );
}
