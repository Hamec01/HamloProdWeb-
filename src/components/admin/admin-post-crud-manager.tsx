"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { PostRichContent } from "@/components/posts/post-rich-content";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MEDIA_IMAGES_BUCKET, POST_FILES_BUCKET, buildStoragePath } from "@/lib/storage/media";
import { postFormSchema, type PostFormValues } from "@/lib/validations/post";
import type { Post } from "@/types";

const defaultValues: PostFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "news",
  section: "vst",
  coverPalette: "from-amber-900 via-stone-900 to-black",
  ctaLabel: null,
  ctaUrl: null,
  published: true,
  featured: true,
};

export function AdminPostCrudManager({ posts, hasSupabase }: { posts: Post[]; hasSupabase: boolean }) {
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState(defaultValues.content);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  });

  const contentField = register("content");

  const insertAtCursor = (snippet: string) => {
    const current = getValues("content") ?? "";
    const textarea = contentRef.current;
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`;

    setValue("content", next, { shouldDirty: true, shouldValidate: true });
    setLiveContent(next);

    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + snippet.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const uploadInlineAsset = async (file: File, kind: "image" | "file") => {
    if (!hasSupabase) {
      setStatusMessage("Сначала нужно подключить Supabase env.");
      return;
    }

    const slug = getValues("slug") || getValues("title") || "post";

    try {
      const supabase = createSupabaseBrowserClient();
      const bucket = kind === "image" ? MEDIA_IMAGES_BUCKET : POST_FILES_BUCKET;
      const path = buildStoragePath(slug, kind === "image" ? "post-image" : "post-file", file.name);
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });

      if (error) {
        setStatusMessage(error.message);
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);

      if (kind === "image") {
        const caption = window.prompt("Подпись для картинки", file.name.replace(/\.[^.]+$/, "")) || file.name;
        insertAtCursor(`\n![${caption}](${data.publicUrl})\n`);
        setStatusMessage("Картинка загружена и вставлена в текст.");
        return;
      }

      const label = window.prompt("Название ссылки для скачивания", file.name) || file.name;
      insertAtCursor(`\n[file:${label}](${data.publicUrl})\n`);
      setStatusMessage("Файл загружен и добавлен как ссылка для скачивания.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const rows = useMemo(
    () =>
      posts.map((post) => [
        post.title,
        post.category,
        post.section,
        post.published ? "published" : "draft",
        new Date(post.createdAt).toLocaleDateString("ru-RU"),
        <div key={post.id} className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEditingId(post.id);
              setValue("title", post.title);
              setValue("slug", post.slug);
              setValue("excerpt", post.excerpt);
              setValue("content", post.content);
              setLiveContent(post.content);
              setValue("category", post.category);
              setValue("section", post.section);
              setValue("coverPalette", post.coverPalette);
              setValue("ctaLabel", post.ctaLabel);
              setValue("ctaUrl", post.ctaUrl);
              setValue("published", post.published);
              setValue("featured", post.featured);
              setStatusMessage(null);
            }}
          >
            Edit
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              if (!hasSupabase) {
                setStatusMessage("CRUD активируется после настройки Supabase env и логина.");
                return;
              }

              if (!window.confirm(`Удалить пост ${post.title}?`)) {
                return;
              }

              const response = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setStatusMessage(payload?.error ?? "Delete failed.");
                return;
              }

              setStatusMessage("Пост удалён.");
              if (editingId === post.id) {
                setEditingId(null);
                reset(defaultValues);
              }
              router.refresh();
            }}
          >
            Delete
          </Button>
        </div>,
      ]),
    [editingId, hasSupabase, posts, reset, router, setValue],
  );

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Editorial CMS</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Posts Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Здесь можно создавать новости, анонсы, статьи и посты для VST. Пиши на русском — английская версия на публичной странице будет переводиться автоматически.
            </p>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--color-paper-400)]">
              Поддерживаются заголовки, списки, цитаты, ссылки, картинки внутри текста и кнопки скачивания файлов.
            </p>
          </div>
          {!hasSupabase ? (
            <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--color-paper-200)]">
              Supabase env не настроены. Сейчас доступен только mock preview.
            </div>
          ) : null}
        </div>
      </section>

      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
              {editingId ? "Edit post" : "Create post"}
            </p>
            <h2 className="mt-2 font-sans text-4xl uppercase tracking-[0.05em]">Post Record</h2>
          </div>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                reset(defaultValues);
                setLiveContent(defaultValues.content);
                setStatusMessage(null);
              }}
            >
              Cancel Edit
            </Button>
          ) : null}
        </div>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={handleSubmit(async (values) => {
            if (!hasSupabase) {
              setStatusMessage("CRUD активируется после настройки Supabase env и логина.");
              return;
            }

            setStatusMessage(null);

            const endpoint = editingId ? `/api/admin/posts/${editingId}` : "/api/admin/posts";
            const method = editingId ? "PUT" : "POST";
            const response = await fetch(endpoint, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
              setStatusMessage(payload?.error ?? "Save failed.");
              return;
            }

            setStatusMessage(editingId ? "Пост обновлён." : "Пост создан.");
            setEditingId(null);
            reset(defaultValues);
            setLiveContent(defaultValues.content);
            router.refresh();
          })}
        >
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Title</span>
            <input {...register("title")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.title ? <span className="text-xs text-[var(--color-alert)]">{errors.title.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Slug</span>
            <input {...register("slug")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.slug ? <span className="text-xs text-[var(--color-alert)]">{errors.slug.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Category</span>
            <input {...register("category")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.category ? <span className="text-xs text-[var(--color-alert)]">{errors.category.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Section</span>
            <select {...register("section")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <option value="vst">VST</option>
              <option value="general">General</option>
              <option value="beats">Beats</option>
              <option value="tracks">Tracks</option>
              <option value="artists">Artists</option>
            </select>
            {errors.section ? <span className="text-xs text-[var(--color-alert)]">{errors.section.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Excerpt</span>
            <textarea {...register("excerpt")} rows={3} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.excerpt ? <span className="text-xs text-[var(--color-alert)]">{errors.excerpt.message}</span> : null}
          </label>

          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => insertAtCursor("\n## Заголовок\n")}>H2</Button>
              <Button type="button" variant="ghost" onClick={() => insertAtCursor("\n### Подзаголовок\n")}>H3</Button>
              <Button type="button" variant="ghost" onClick={() => insertAtCursor("\n> Цитата\n")}>Quote</Button>
              <Button type="button" variant="ghost" onClick={() => insertAtCursor("\n- Пункт 1\n- Пункт 2\n")}>List</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const label = window.prompt("Текст ссылки", "Открыть сайт");
                  const url = window.prompt("URL", "https://");
                  if (label && url) {
                    insertAtCursor(`[${label}](${url})`);
                  }
                }}
              >
                Link
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
                <span>Добавить картинку в текст</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadInlineAsset(file, "image");
                    }
                    event.currentTarget.value = "";
                  }}
                  className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
                />
              </label>

              <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
                <span>Добавить файл на скачивание</span>
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadInlineAsset(file, "file");
                    }
                    event.currentTarget.value = "";
                  }}
                  className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
                />
              </label>
            </div>

            <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
              <span>Content</span>
              <textarea
                {...contentField}
                onChange={(event) => {
                  contentField.onChange(event);
                  setLiveContent(event.target.value);
                }}
                ref={(element) => {
                  contentField.ref(element);
                  contentRef.current = element;
                }}
                rows={14}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 font-mono text-sm"
              />
              <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
                Используй панель выше или вставляй шаблоны вручную: ![Подпись](url) для картинки и [file:Название](url) для файла.
              </span>
              {errors.content ? <span className="text-xs text-[var(--color-alert)]">{errors.content.message}</span> : null}
            </label>

            <div className="rounded-2xl border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">Live Preview</p>
              <PostRichContent content={liveContent || ""} />
            </div>
          </div>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>CTA label</span>
            <input {...register("ctaLabel")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.ctaLabel ? <span className="text-xs text-[var(--color-alert)]">{errors.ctaLabel.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>CTA URL</span>
            <input {...register("ctaUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.ctaUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.ctaUrl.message}</span> : null}
          </label>

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Cover palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.coverPalette ? <span className="text-xs text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>

          <label className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("published")} className="h-4 w-4" />
            <span>Published</span>
          </label>

          <label className="flex items-center gap-3 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("featured")} className="h-4 w-4" />
            <span>Featured</span>
          </label>

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingId ? "Update Post" : "Create Post"}
            </Button>
            {statusMessage ? <span className="text-sm text-[var(--color-paper-200)]">{statusMessage}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Published Content"
        description="Новости и посты, которыми теперь можно управлять из админки без ручного редактирования кода."
        columns={["Title", "Category", "Section", "Status", "Created", "Actions"]}
        rows={rows}
      />
    </div>
  );
}
