"use client";

import { useState, useEffect } from "react";
import { dictionary, type Locale } from "@/lib/i18n";
import type { Comment } from "@/types";

type Props = {
  entity: Comment["entity"];
  contentId: string;
  isAuthenticated: boolean;
  locale: Locale;
};

export function CommentsSection({ entity, contentId, isAuthenticated, locale }: Props) {
  const t = dictionary[locale];
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [body, setBody] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/comments?entity=${encodeURIComponent(entity)}&contentId=${encodeURIComponent(contentId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.comments)) setComments(data.comments);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [entity, contentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, contentId, displayName: displayName.trim() || null, body: body.trim(), stars }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
        setBody("");
        setDisplayName("");
        setStars(null);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка при отправке");
    }

    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="space-y-6 border-t border-[var(--color-line)] pt-6">
      <h3 className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{t.commentsTitle}</h3>

      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder={t.yourName}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-paper-200)] placeholder:text-[var(--color-paper-500)] focus:border-amber-500 focus:outline-none"
          />

          {/* Star selector */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(stars === n ? null : n)}
                className={`text-lg leading-none transition-colors ${
                  stars !== null && n <= stars ? "text-amber-400" : "text-[var(--color-paper-600)]"
                }`}
              >
                ★
              </button>
            ))}
            {stars !== null && (
              <span className="ml-2 text-xs text-[var(--color-paper-400)]">{stars}/5</span>
            )}
          </div>

          <textarea
            placeholder={t.commentPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-paper-200)] placeholder:text-[var(--color-paper-500)] focus:border-amber-500 focus:outline-none resize-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="border border-amber-500 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
          >
            {submitting ? "..." : t.submitComment}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-[var(--color-paper-500)]">...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--color-paper-400)]">{t.noComments}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-[var(--color-line)] pl-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--color-paper-200)]">
                  {c.displayName || "Аноним"}
                </span>
                <div className="flex items-center gap-2">
                  {c.stars !== null && (
                    <span className="text-xs text-amber-400">{"★".repeat(c.stars)}</span>
                  )}
                  <span className="text-[10px] text-[var(--color-paper-500)]">
                    {new Date(c.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US")}
                  </span>
                  {isAuthenticated && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-[10px] text-[var(--color-paper-500)] hover:text-red-400 transition-colors"
                    >
                      {t.deleteComment}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--color-paper-300)] whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
