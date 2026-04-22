"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MEDIA_IMAGES_BUCKET, TRACK_DOWNLOADS_BUCKET, buildStoragePath } from "@/lib/storage/media";
import { releaseFormSchema, type ReleaseFormValues } from "@/lib/validations/release";
import type { Release } from "@/types";

const releaseTypeLabels: Record<Release["releaseType"], string> = {
  album: "Альбом",
  ep: "EP",
  mixtape: "Mixtape",
};

const defaultValues: ReleaseFormValues = {
  title: "",
  slug: "",
  artistName: "HaM",
  releaseType: "ep",
  coverPalette: "from-zinc-900 via-stone-900 to-black",
  coverImageUrl: null,
  coverImagePath: null,
  description: "",
  spotifyUrl: "",
  appleMusicUrl: "",
  youtubeUrl: "",
  releaseDate: new Date().toISOString().slice(0, 10),
  published: true,
  featured: false,
  tracks: [{ title: "", slug: "", trackNumber: 1, mp3FilePath: null }],
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminReleaseCrudManager({
  releases,
  hasSupabase,
}: {
  releases: Release[];
  hasSupabase: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [trackMp3s, setTrackMp3s] = useState<(File | null)[]>([null]);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tracks" });

  const watchedTitle = watch("title");

  // Auto-slugify title → slug for release
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!editingId) {
        setValue("slug", slugify(value));
      }
    },
    [editingId, setValue],
  );

  // Auto-slugify track title → track slug
  const handleTrackTitleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValue(`tracks.${index}.slug`, slugify(value));
    },
    [setValue],
  );

  const addTrack = useCallback(() => {
    append({ title: "", slug: "", trackNumber: fields.length + 1, mp3FilePath: null });
    setTrackMp3s((prev) => [...prev, null]);
  }, [append, fields.length]);

  const removeTrack = useCallback(
    (index: number) => {
      remove(index);
      setTrackMp3s((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
      // Renumber remaining tracks
      setTimeout(() => {
        fields.forEach((_, i) => {
          if (i > index) setValue(`tracks.${i - 1}.trackNumber`, i);
        });
      }, 0);
    },
    [remove, fields, setValue],
  );

  const setTrackMp3 = useCallback((index: number, file: File | null) => {
    setTrackMp3s((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }, []);

  const onSubmit = async (data: ReleaseFormValues) => {
    if (!hasSupabase) {
      setStatusMessage("CRUD активируется после настройки Supabase env и логина.");
      return;
    }

    setStatusMessage(null);
    const supabase = createSupabaseBrowserClient();

    // 1. Upload cover image if provided
    let coverImageUrl = data.coverImageUrl;
    let coverImagePath = data.coverImagePath;
    if (coverFile) {
      const path = buildStoragePath(data.slug, "cover", coverFile.name);
      const { error: coverError, data: coverData } = await supabase.storage
        .from(MEDIA_IMAGES_BUCKET)
        .upload(path, coverFile, { upsert: true });
      if (!coverError && coverData) {
        const { data: urlData } = supabase.storage.from(MEDIA_IMAGES_BUCKET).getPublicUrl(path);
        coverImageUrl = urlData.publicUrl;
        coverImagePath = path;
        setValue("coverImageUrl", coverImageUrl);
        setValue("coverImagePath", coverImagePath);
      }
    }

    // 2. Upload MP3s per track
    const updatedTracks = await Promise.all(
      data.tracks.map(async (track, i) => {
        const mp3File = trackMp3s[i];
        if (!mp3File) return track;
        const path = buildStoragePath(track.slug || data.slug, "track", mp3File.name);
        const { error: mp3Error } = await supabase.storage
          .from(TRACK_DOWNLOADS_BUCKET)
          .upload(path, mp3File, { upsert: true });
        if (!mp3Error) {
          setValue(`tracks.${i}.mp3FilePath`, path);
          return { ...track, mp3FilePath: path };
        }
        return track;
      }),
    );

    const payload = {
      ...data,
      coverImageUrl,
      coverImagePath,
      tracks: updatedTracks,
    };

    const url = editingId ? `/api/admin/releases/${editingId}` : "/api/admin/releases";
    const method = editingId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setStatusMessage(result?.error ?? "Ошибка сохранения.");
      return;
    }

    setStatusMessage(editingId ? "Release обновлён." : "Release создан.");
    reset(defaultValues);
    setEditingId(null);
    setCoverFile(null);
    setTrackMp3s([null]);
    if (coverFileRef.current) coverFileRef.current.value = "";
    router.refresh();
  };

  const startEdit = (release: Release) => {
    setEditingId(release.id);
    setValue("title", release.title);
    setValue("slug", release.slug);
    setValue("artistName", release.artistName);
    setValue("releaseType", release.releaseType);
    setValue("coverPalette", release.coverPalette);
    setValue("coverImageUrl", release.coverImageUrl);
    setValue("coverImagePath", release.coverImagePath);
    setValue("description", release.description);
    setValue("spotifyUrl", release.spotifyUrl);
    setValue("appleMusicUrl", release.appleMusicUrl);
    setValue("youtubeUrl", release.youtubeUrl);
    setValue("releaseDate", release.releaseDate);
    setValue("published", release.published);
    setValue("featured", release.featured);
    // Replace tracks with existing ones
    const existingTracks = release.tracks.map((t) => ({
      title: t.title,
      slug: t.slug,
      trackNumber: t.trackNumber,
      mp3FilePath: t.mp3FilePath,
    }));
    setValue("tracks", existingTracks.length > 0 ? existingTracks : [{ title: "", slug: "", trackNumber: 1, mp3FilePath: null }]);
    setTrackMp3s(new Array(existingTracks.length || 1).fill(null));
    setCoverFile(null);
    setStatusMessage(null);
    if (coverFileRef.current) coverFileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rows = useMemo(
    () =>
      releases.map((release) => [
        <span key={`type-${release.id}`} className="uppercase tracking-widest text-xs text-[var(--color-paper-400)]">
          {releaseTypeLabels[release.releaseType]}
        </span>,
        release.title,
        release.artistName,
        release.releaseDate,
        `${release.tracks.length} тр.`,
        release.published ? "✓" : "—",
        <div key={`actions-${release.id}`} className="flex gap-2">
          <Button variant="ghost" onClick={() => startEdit(release)}>
            Edit
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              if (!hasSupabase) {
                setStatusMessage("CRUD активируется после настройки Supabase env и логина.");
                return;
              }
              if (!window.confirm(`Удалить релиз "${release.title}"?`)) return;
              const response = await fetch(`/api/admin/releases/${release.id}`, { method: "DELETE" });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              if (!response.ok) {
                setStatusMessage(payload?.error ?? "Delete failed.");
                return;
              }
              setStatusMessage("Release удалён.");
              if (editingId === release.id) {
                setEditingId(null);
                reset(defaultValues);
                setTrackMp3s([null]);
              }
              router.refresh();
            }}
          >
            Delete
          </Button>
        </div>,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [releases, hasSupabase, editingId],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Releases Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Управление альбомами, EP и mixtape — добавляй несколько треков за раз, прикрепляй обложку.
            </p>
          </div>
          {!hasSupabase ? (
            <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--color-paper-200)]">
              Supabase env не настроены. Страница работает в режиме просмотра mock data.
            </div>
          ) : null}
        </div>
      </section>

      {/* Form */}
      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
              {editingId ? "Edit Release" : "New Release"}
            </p>
            <h2 className="mt-2 font-sans text-4xl uppercase tracking-[0.05em]">
              {editingId ? watchedTitle || "Release" : "Создать релиз"}
            </h2>
          </div>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                reset(defaultValues);
                setEditingId(null);
                setCoverFile(null);
                setTrackMp3s([null]);
                setStatusMessage(null);
              }}
            >
              ✕ Отмена
            </Button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* ── Release Metadata ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Название *</label>
              <input
                {...register("title")}
                onChange={(e) => {
                  register("title").onChange(e);
                  handleTitleChange(e);
                }}
                placeholder="Grey Season EP"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
              {errors.title && <p className="text-xs text-[var(--color-alert)]">{errors.title.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Slug *</label>
              <input
                {...register("slug")}
                placeholder="grey-season-ep"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
              {errors.slug && <p className="text-xs text-[var(--color-alert)]">{errors.slug.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Артист *</label>
              <input
                {...register("artistName")}
                placeholder="HaM"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Тип *</label>
              <select
                {...register("releaseType")}
                className="w-full border border-[var(--color-line)] bg-[var(--color-ash-950)] px-3 py-2 text-sm focus:outline-none"
              >
                <option value="ep">EP</option>
                <option value="album">Альбом</option>
                <option value="mixtape">Mixtape</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Дата релиза *</label>
              <input
                {...register("releaseDate")}
                type="date"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Cover Gradient</label>
              <input
                {...register("coverPalette")}
                placeholder="from-zinc-900 via-stone-900 to-black"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Cover image upload */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Обложка</p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="cursor-pointer border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] hover:bg-[rgba(255,255,255,0.04)]">
                Загрузить изображение
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {coverFile ? (
                <span className="text-xs text-[var(--color-paper-200)]">{coverFile.name}</span>
              ) : watch("coverImagePath") ? (
                <span className="text-xs text-[var(--color-paper-200)]">✓ {watch("coverImagePath")}</span>
              ) : null}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Описание</label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Краткое описание релиза..."
              className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          {/* Streaming links */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Spotify</label>
              <input
                {...register("spotifyUrl")}
                placeholder="https://open.spotify.com/..."
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Apple Music</label>
              <input
                {...register("appleMusicUrl")}
                placeholder="https://music.apple.com/..."
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">YouTube</label>
              <input
                {...register("youtubeUrl")}
                placeholder="https://youtube.com/..."
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-paper-200)]">
              <input type="checkbox" {...register("published")} className="h-4 w-4 accent-amber-500" />
              Опубликован
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-paper-200)]">
              <input type="checkbox" {...register("featured")} className="h-4 w-4 accent-amber-500" />
              Featured
            </label>
          </div>

          {/* ── Track List ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">Треки</p>
              {errors.tracks && !Array.isArray(errors.tracks) && (
                <p className="text-xs text-[var(--color-alert)]">{errors.tracks.message}</p>
              )}
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">
                      Трек {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrack(index)}
                        className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)] hover:text-[var(--color-alert)]"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" {...register(`tracks.${index}.trackNumber`, { valueAsNumber: true })} />
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--color-paper-400)]">Название *</label>
                      <input
                        {...register(`tracks.${index}.title`)}
                        onChange={(e) => {
                          register(`tracks.${index}.title`).onChange(e);
                          handleTrackTitleChange(index, e);
                        }}
                        placeholder="Track Title"
                        className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
                      />
                      {errors.tracks?.[index]?.title && (
                        <p className="text-xs text-[var(--color-alert)]">{errors.tracks[index].title?.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--color-paper-400)]">Slug</label>
                      <input
                        {...register(`tracks.${index}.slug`)}
                        placeholder="track-title"
                        className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs text-[var(--color-paper-400)]">MP3 файл</label>
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer border border-[var(--color-line)] px-3 py-1.5 text-xs uppercase tracking-[0.16em] hover:bg-[rgba(255,255,255,0.04)]">
                          Выбрать файл
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3"
                            className="hidden"
                            onChange={(e) => setTrackMp3(index, e.target.files?.[0] ?? null)}
                          />
                        </label>
                        {trackMp3s[index] ? (
                          <span className="text-xs text-[var(--color-paper-200)]">{trackMp3s[index]?.name}</span>
                        ) : watch(`tracks.${index}.mp3FilePath`) ? (
                          <span className="text-xs text-[var(--color-paper-200)]">✓ {watch(`tracks.${index}.mp3FilePath`)}</span>
                        ) : (
                          <span className="text-xs text-[var(--color-paper-400)]">не загружен</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={addTrack}>
              + Добавить трек
            </Button>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Сохранение..." : editingId ? "Сохранить изменения" : "Создать релиз"}
            </Button>
            {statusMessage && (
              <p className="text-sm text-[var(--color-paper-200)]">{statusMessage}</p>
            )}
          </div>
        </form>
      </section>

      {/* Table */}
      {releases.length > 0 && (
        <section className="case-panel p-6">
          <AdminCollectionTable
            title="Все релизы"
            description="Альбомы, EP, mixtape — управление из этой таблицы."
            columns={["Тип", "Название", "Артист", "Дата", "Треки", "Pub", "Действия"]}
            rows={rows}
          />
        </section>
      )}
    </div>
  );
}
