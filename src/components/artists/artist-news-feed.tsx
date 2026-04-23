"use client";

import { useState, useRef } from "react";
import { dictionary, type Locale } from "@/lib/i18n";
import type { ArtistPost } from "@/types";
import { ArtistPostCard } from "./artist-post-card";

type Props = {
  artistId: string;
  initialPosts: ArtistPost[];
  isOwner: boolean;
  isAuthenticated: boolean;
  locale: Locale;
};

export function ArtistNewsFeed({ artistId, initialPosts, isOwner, isAuthenticated, locale }: Props) {
  const t = dictionary[locale];
  const [posts, setPosts] = useState<ArtistPost[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setImagePreview(null); return; }
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("artistId", artistId);
    formData.append("title", title.trim());
    formData.append("body", body.trim());
    const imageFile = imageInputRef.current?.files?.[0];
    const audioFile = audioInputRef.current?.files?.[0];
    if (imageFile) formData.append("image", imageFile);
    if (audioFile) formData.append("audio", audioFile);

    const res = await fetch("/api/artist-posts", { method: "POST", body: formData });

    if (res.ok) {
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [data.post, ...prev]);
        setTitle("");
        setBody("");
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
        if (audioInputRef.current) audioInputRef.current.value = "";
        setShowForm(false);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Ошибка при публикации");
    }

    setSubmitting(false);
  }

  function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{t.artistNews}</h2>
        {isOwner && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex h-8 w-8 items-center justify-center border border-[var(--color-line)] text-lg leading-none text-[var(--color-paper-200)] transition-colors hover:border-amber-500 hover:text-amber-400"
          >
            {showForm ? "×" : "+"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="case-panel space-y-4 p-6">
          <input
            type="text"
            placeholder={locale === "ru" ? "Заголовок" : "Title"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-paper-200)] placeholder:text-[var(--color-paper-500)] focus:border-amber-500 focus:outline-none"
          />
          <textarea
            placeholder={locale === "ru" ? "Текст новости..." : "Post body..."}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
            className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-paper-200)] placeholder:text-[var(--color-paper-500)] focus:border-amber-500 focus:outline-none resize-none"
          />

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-paper-400)]">
              {locale === "ru" ? "Фото (необязательно)" : "Photo (optional)"}
            </label>
            <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImage} className="text-sm text-[var(--color-paper-300)]" />
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="preview" className="h-32 w-auto border border-[var(--color-line)] object-cover" />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.14em] text-[var(--color-paper-400)]">
              {locale === "ru" ? "Аудио (необязательно)" : "Audio (optional)"}
            </label>
            <input type="file" accept="audio/*" ref={audioInputRef} className="text-sm text-[var(--color-paper-300)]" />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="border border-amber-500 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
            >
              {submitting ? "..." : locale === "ru" ? "Опубликовать" : "Publish"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)] transition-colors hover:border-[var(--color-paper-300)]"
            >
              {locale === "ru" ? "Отмена" : "Cancel"}
            </button>
          </div>
        </form>
      )}

      {posts.length === 0 && !showForm && (
        <p className="text-sm text-[var(--color-paper-400)]">
          {locale === "ru" ? "Новостей пока нет." : "No posts yet."}
        </p>
      )}

      <div className="space-y-8">
        {posts.map((post) => (
          <ArtistPostCard
            key={post.id}
            post={post}
            isOwner={isOwner}
            isAuthenticated={isAuthenticated}
            locale={locale}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
