"use client";

import { useState } from "react";
import Image from "next/image";
import { dictionary, type Locale } from "@/lib/i18n";
import type { ArtistPost } from "@/types";
import { CommentsSection } from "./comments-section";

export function ArtistPostCard({
  post,
  isOwner,
  isAuthenticated,
  locale,
  onDelete,
}: {
  post: ArtistPost;
  isOwner: boolean;
  isAuthenticated: boolean;
  locale: Locale;
  onDelete?: (id: string) => void;
}) {
  const t = dictionary[locale];
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(locale === "ru" ? "Удалить эту новость?" : "Delete this post?")) return;
    setDeleting(true);
    const res = await fetch(`/api/artist-posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDelete?.(post.id);
    else setDeleting(false);
  }

  return (
    <article className="case-panel space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-paper-500)]">
            {new Date(post.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h3 className="text-lg font-medium text-[var(--color-paper-100)]">{post.title}</h3>
        </div>
        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 text-xs text-[var(--color-paper-500)] hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {t.deletePost}
          </button>
        )}
      </div>

      {post.imageUrl && (
        <div className="relative h-56 w-full overflow-hidden border border-[var(--color-line)]">
          <Image src={post.imageUrl} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 700px" />
        </div>
      )}

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-paper-300)]">{post.body}</p>

      {post.audioUrl && (
        <audio controls src={post.audioUrl} className="w-full" />
      )}

      <CommentsSection
        entity="artist_post"
        contentId={post.id}
        isAuthenticated={isAuthenticated}
        locale={locale}
      />
    </article>
  );
}
