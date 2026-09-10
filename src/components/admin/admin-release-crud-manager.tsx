"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { uploadAdminAsset } from "@/lib/storage/client-upload";
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
  featArtistNames: "",
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

const CYRILLIC: Record<string, string> = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
  к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};

function transliterate(text: string): string {
  return text.split("").map((c) => CYRILLIC[c.toLowerCase()] ?? c).join("");
}

function slugify(text: string) {
  return transliterate(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nameFromFile(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function AdminReleaseCrudManager({ releases }: { releases: Release[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [trackMp3s, setTrackMp3s] = useState<(File | null)[]>([null]);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const bulkMp3Ref = useRef<HTMLInputElement>(null);

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
    append({ id: undefined, title: "", slug: "", trackNumber: fields.length + 1, mp3FilePath: null });
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

  // When a single track MP3 is chosen → auto-fill title + slug if empty
  const handleTrackMp3FileChange = useCallback(
    (index: number, file: File | null) => {
      setTrackMp3(index, file);
      if (file) {
        const currentTitle = (document.querySelector(`input[name="tracks.${index}.title"]`) as HTMLInputElement | null)?.value ?? "";
        if (!currentTitle) {
          const name = nameFromFile(file.name);
          setValue(`tracks.${index}.title`, name);
          setValue(`tracks.${index}.slug`, slugify(name));
        }
      }
    },
    [setTrackMp3, setValue],
  );

  // Bulk MP3 upload → create a track row for each file
  const handleBulkMp3 = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files);
      // Check if first slot is the untouched default empty track
      const firstTitle = (document.querySelector(`input[name="tracks.0.title"]`) as HTMLInputElement | null)?.value ?? "";
      const isOnlyDefaultEmpty = fields.length === 1 && !firstTitle && !trackMp3s[0];

      if (isOnlyDefaultEmpty) {
        const [first, ...rest] = fileArray;
        const firstName = nameFromFile(first.name);
        setValue("tracks.0.title", firstName);
        setValue("tracks.0.slug", slugify(firstName));
        setValue("tracks.0.trackNumber", 1);
        const newMp3s: (File | null)[] = [first];
        rest.forEach((file, i) => {
          const name = nameFromFile(file.name);
          append({ id: undefined, title: name, slug: slugify(name), trackNumber: i + 2, mp3FilePath: null });
          newMp3s.push(file);
        });
        setTrackMp3s(newMp3s);
      } else {
        const startNum = fields.length + 1;
        fileArray.forEach((file, i) => {
          const name = nameFromFile(file.name);
          append({ id: undefined, title: name, slug: slugify(name), trackNumber: startNum + i, mp3FilePath: null });
        });
        setTrackMp3s((prev) => [...prev, ...fileArray]);
      }
    },
    [fields.length, trackMp3s, setValue, append],
  );

  const onSubmit = async (data: ReleaseFormValues) => {
    setStatusMessage(null);

    // 1. Save metadata first so an upload has a stable entity id for the object key.
    let releaseId = editingId;
    const firstPayload = { ...data, tracks: data.tracks };
    if (!releaseId) {
      const createRes = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firstPayload),
      });
      const created = (await createRes.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!createRes.ok || !created?.id) {
        setStatusMessage(created?.error ?? "Ошибка сохранения.");
        return;
      }
      releaseId = created.id;
    }

    // 2. Upload the cover (shared by the release and its tracks) if a new file was picked.
    let coverImagePath = data.coverImagePath;
    let coverImageUrl = data.coverImageUrl;
    if (coverFile) {
      try {
        setStatusMessage("Загрузка обложки…");
        const { key, publicUrl } = await uploadAdminAsset("track-cover", releaseId, coverFile);
        coverImagePath = key;
        coverImageUrl = publicUrl;
        setValue("coverImagePath", key);
        if (publicUrl) setValue("coverImageUrl", publicUrl);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Не удалось загрузить обложку.");
        return;
      }
    }

    const payload = { ...data, coverImageUrl, coverImagePath, tracks: data.tracks };

    const response = await fetch(`/api/admin/releases/${releaseId}`, {
      method: "PUT",
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
    setValue("featArtistNames", release.featArtistNames ?? "");
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
      id: t.id,
      title: t.title,
      slug: t.slug,
      trackNumber: t.trackNumber,
      mp3FilePath: t.mp3FilePath,
    }));
    setValue("tracks", existingTracks.length > 0 ? existingTracks : [{ id: undefined, title: "", slug: "", trackNumber: 1, mp3FilePath: null }]);
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
    [releases, editingId],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">PostgreSQL CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Releases Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Управление альбомами, EP и mixtape — добавляй несколько треков за раз, прикрепляй обложку.
            </p>
          </div>
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
              <label className="text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">Фит. артисты</label>
              <input
                {...register("featArtistNames")}
                placeholder="ТриатлON, DJ Name"
                className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm focus:outline-none"
              />
              <p className="text-[10px] text-[var(--color-paper-500)]">Через запятую. Страницы этих артистов автоматически подхватят релиз.</p>
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
                    <input type="hidden" {...register(`tracks.${index}.id`)} />
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
                            onChange={(e) => handleTrackMp3FileChange(index, e.target.files?.[0] ?? null)}
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
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" onClick={addTrack}>
                + Добавить трек
              </Button>
              <label className="cursor-pointer border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-200)] hover:bg-[rgba(255,255,255,0.04)]">
                + Загрузить несколько треков
                <input
                  ref={bulkMp3Ref}
                  type="file"
                  accept="audio/mpeg,audio/mp3"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleBulkMp3(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
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
