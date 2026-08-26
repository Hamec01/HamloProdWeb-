"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminBeatPlayButton } from "@/components/admin/admin-beat-play-button";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { analyzeAudioFile } from "@/lib/audio/analyze-audio";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  BEAT_DOWNLOADS_BUCKET,
  BEAT_PREVIEWS_BUCKET,
  MEDIA_IMAGES_BUCKET,
  buildBeatPreviewStoragePath,
  buildStoragePath,
} from "@/lib/storage/media";
import { BEAT_GENRES, BEAT_MOODS, BEAT_SUBSTYLES, getGenreLabel } from "@/lib/beats-taxonomy";
import {
  beatFormSchema,
  PREVIEW_ALLOWED_EXTENSIONS,
  PREVIEW_ALLOWED_MIME_TYPES,
  PREVIEW_MAX_SIZE_BYTES,
  type BeatFormValues,
} from "@/lib/validations/beat";
import { hasAllowedPreviewExtension } from "@/lib/validations/preview-audio";
import { generateSlug, getNextCaseNumber } from "@/lib/slug";
import type { Beat } from "@/types";

const defaultValues: BeatFormValues = {
  title: "",
  slug: "",
  caseNumber: "",
  coverPalette: "from-stone-700 via-stone-900 to-zinc-950",
  coverImageUrl: null,
  coverImagePath: null,
  previewUrl: null,
  previewStoragePath: null,
  previewFileName: null,
  previewMimeType: null,
  previewSizeBytes: null,
  wavFilePath: null,
  zipFilePath: null,
  genre: "boombap",
  substyle: "Classic",
  bpm: 90,
  mood: "Melancholic",
  description: "Beat description goes here.",
  duration: "02:30",
  status: "available",
  priceUsd: 100,
  priceRub: 2500,
  featured: false,
  availableForDownload: false,
};

export function AdminBeatCrudManager({ beats, hasSupabase }: { beats: Beat[]; hasSupabase: boolean }) {
  const router = useRouter();
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPostingTelegram, setIsPostingTelegram] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [wavFile, setWavFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BeatFormValues>({
    resolver: zodResolver(beatFormSchema),
    defaultValues: {
      ...defaultValues,
      caseNumber: getNextCaseNumber(beats),
    },
  });

  const selectedGenre = watch("genre");
  const substyleOptions = BEAT_SUBSTYLES[selectedGenre] ?? BEAT_SUBSTYLES.boombap;
  const watchedTitle = watch("title");
  const watchedStatus = watch("status");

  useEffect(() => {
    const currentSubstyle = watch("substyle");
    if (!substyleOptions.includes(currentSubstyle)) {
      setValue("substyle", substyleOptions[0], { shouldValidate: true, shouldDirty: true });
    }
  }, [selectedGenre, setValue, substyleOptions, watch]);

  // Auto-fill Case Number when in create mode
  useEffect(() => {
    if (!editingBeatId) {
      const nextCase = getNextCaseNumber(beats);
      setValue("caseNumber", nextCase, { shouldValidate: true });
    }
  }, [beats, editingBeatId, setValue]);

  // Auto-generate Latin Slug from Title (with Cyrillic transliteration)
  useEffect(() => {
    if (!editingBeatId && !isSlugManuallyEdited && watchedTitle !== undefined) {
      const autoSlug = generateSlug(watchedTitle);
      setValue("slug", autoSlug, { shouldValidate: true });
    }
  }, [watchedTitle, editingBeatId, isSlugManuallyEdited, setValue]);

  const modeLabel = editingBeatId ? "Edit Beat" : "Create Beat";
  const activeBeat = editingBeatId ? beats.find((beat) => beat.id === editingBeatId) ?? null : null;

  const handleQuickStatusChange = async (beatId: string, nextStatus: "available" | "sold" | "reserved" | "private") => {
    if (!hasSupabase) {
      setStatusMessage("CRUD активируется после настройки Supabase env и логина.");
      return;
    }

    const beat = beats.find((b) => b.id === beatId);
    setStatusMessage(`Обновляю статус для "${beat?.title ?? "Beat"}"...`);

    try {
      const response = await fetch(`/api/admin/beats/${beatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatusMessage(payload?.error ?? "Не удалось обновить статус.");
        return;
      }

      setStatusMessage(
        nextStatus === "sold"
          ? `Бит "${beat?.title ?? "Beat"}" помечен как ПРОДАН и скрыт с витрины.`
          : `Бит "${beat?.title ?? "Beat"}" возвращен в продажу.`,
      );
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Ошибка обновления статуса.");
    }
  };

  const renderStatusBadge = (status: Beat["status"]) => {
    switch (status) {
      case "sold":
        return (
          <span className="inline-block border border-red-700 bg-red-950/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-300">
            🔴 Продан
          </span>
        );
      case "reserved":
        return (
          <span className="inline-block border border-amber-700 bg-amber-950/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            Резерв
          </span>
        );
      case "private":
        return (
          <span className="inline-block border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] uppercase tracking-wider text-zinc-400">
            Приват
          </span>
        );
      case "available":
      default:
        return (
          <span className="inline-block border border-emerald-700 bg-emerald-950/50 px-2 py-0.5 text-[11px] uppercase tracking-wider text-emerald-300">
            В продаже
          </span>
        );
    }
  };

  const rows = useMemo(
    () =>
      beats.map((beat) => [
        <AdminBeatPlayButton key={`play-${beat.id}`} beat={beat} />,
        <div key={`title-${beat.id}`} className="space-y-0.5">
          <div className="font-medium text-[var(--color-paper-100)]">{beat.title}</div>
          <div className="text-[11px] text-[var(--color-paper-400)]">{beat.caseNumber} • {beat.slug}</div>
        </div>,
        beat.coverImagePath ? "ready" : "palette",
        beat.previewStoragePath ? "ready" : beat.previewUrl ? "external" : "missing",
        beat.wavFilePath ? "ready" : "missing",
        beat.zipFilePath ? "ready" : "missing",
        String(beat.bpm),
        `${getGenreLabel(beat.genre, "en")} / ${beat.substyle} / ${beat.mood}`,
        `$${beat.priceUsd} / ₽${beat.priceRub}`,
        <div key={`status-${beat.id}`}>{renderStatusBadge(beat.status)}</div>,
        <div key={`actions-${beat.id}`} className="flex items-center gap-2 whitespace-nowrap">
          {beat.status === "sold" ? (
            <Button
              variant="primary"
              onClick={() => handleQuickStatusChange(beat.id, "available")}
              className="text-xs px-2.5 py-1 text-emerald-300 border-emerald-700/60 hover:bg-emerald-950/50"
              title="Снять метку 'Продано' и вернуть бит на витрину"
            >
              В продажу
            </Button>
          ) : (
            <Button
              variant="alert"
              onClick={() => handleQuickStatusChange(beat.id, "sold")}
              className="text-xs px-2.5 py-1 text-red-300 border-red-700/60 hover:bg-red-950/50"
              title="Пометить бит как 'Продано' и скрыть с витрины"
            >
              Продано
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setEditingBeatId(beat.id);
              setIsSlugManuallyEdited(true);
              setValue("title", beat.title);
              setValue("slug", beat.slug);
              setValue("caseNumber", beat.caseNumber);
              setValue("coverPalette", beat.coverPalette);
              setValue("coverImageUrl", beat.coverImageUrl);
              setValue("coverImagePath", beat.coverImagePath);
              setValue("previewUrl", beat.previewUrl);
              setValue("previewStoragePath", beat.previewStoragePath);
              setValue("previewFileName", beat.previewFileName ?? null);
              setValue("previewMimeType", beat.previewMimeType ?? null);
              setValue("previewSizeBytes", beat.previewSizeBytes ?? null);
              setValue("wavFilePath", beat.wavFilePath);
              setValue("zipFilePath", beat.zipFilePath);
              setValue("genre", beat.genre);
              setValue("substyle", beat.substyle);
              setValue("bpm", beat.bpm);
              setValue("mood", beat.mood);
              setValue("description", beat.description);
              setValue("duration", beat.duration);
              setValue("status", beat.status);
              setValue("priceUsd", beat.priceUsd);
              setValue("priceRub", beat.priceRub);
              setValue("availableForDownload", beat.availableForDownload);
              setValue("featured", beat.featured);
              setCoverImageFile(null);
              setPreviewFile(null);
              setWavFile(null);
              setZipFile(null);
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

              if (!window.confirm(`Delete ${beat.title}?`)) {
                return;
              }

              const response = await fetch(`/api/admin/beats/${beat.id}`, {
                method: "DELETE",
              });

              const payload = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setStatusMessage(payload?.error ?? "Delete failed.");
                return;
              }

              setStatusMessage("Beat deleted.");
              if (editingBeatId === beat.id) {
                setEditingBeatId(null);
                setIsSlugManuallyEdited(false);
                reset({
                  ...defaultValues,
                  caseNumber: getNextCaseNumber(beats),
                });
                setCoverImageFile(null);
                setPreviewFile(null);
                setWavFile(null);
                setZipFile(null);
              }
              router.refresh();
            }}
          >
            Delete
          </Button>
        </div>,
      ]),
    [beats, editingBeatId, hasSupabase, reset, router, setValue],
  );

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Beats Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Создание, редактирование и удаление работают через Supabase API при настроенных env и активной admin/editor сессии.
            </p>
          </div>
          {!hasSupabase ? (
            <div className="border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--color-paper-200)]">
              Supabase env не настроены. Сейчас страница работает в режиме просмотра mock data.
            </div>
          ) : null}
        </div>
      </section>

      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{modeLabel}</p>
            <h2 className="mt-2 font-sans text-4xl uppercase tracking-[0.05em]">Beat Record</h2>
          </div>
          {editingBeatId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={isPostingTelegram}
                onClick={async () => {
                  if (!editingBeatId) {
                    return;
                  }

                  if (!hasSupabase) {
                    setStatusMessage("Telegram post requires Supabase env configuration.");
                    return;
                  }

                  setIsPostingTelegram(true);
                  setStatusMessage("Posting to Telegram...");

                  try {
                    const response = await fetch(`/api/admin/beats/${editingBeatId}/telegram`, {
                      method: "POST",
                    });

                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

                    if (!response.ok) {
                      setStatusMessage(payload?.error ?? "Failed to publish beat to Telegram.");
                      return;
                    }

                    setStatusMessage("Beat posted to Telegram.");
                  } catch (error) {
                    setStatusMessage(error instanceof Error ? error.message : "Failed to publish beat to Telegram.");
                  } finally {
                    setIsPostingTelegram(false);
                  }
                }}
              >
                {isPostingTelegram ? "Posting..." : "Post to Telegram"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingBeatId(null);
                  setIsSlugManuallyEdited(false);
                  reset({
                    ...defaultValues,
                    caseNumber: getNextCaseNumber(beats),
                  });
                  setCoverImageFile(null);
                  setPreviewFile(null);
                  setWavFile(null);
                  setZipFile(null);
                  setStatusMessage(null);
                }}
              >
                Cancel Edit
              </Button>
            </div>
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

            const nextValues: BeatFormValues = {
              ...values,
            };

            try {
              const supabase = createSupabaseBrowserClient();

              if (coverImageFile) {
                const coverImagePath = buildStoragePath(values.slug, "cover", coverImageFile.name);
                const { error: coverUploadError } = await supabase.storage.from(MEDIA_IMAGES_BUCKET).upload(coverImagePath, coverImageFile, {
                  upsert: true,
                  contentType: coverImageFile.type || undefined,
                });

                if (coverUploadError) {
                  setStatusMessage(coverUploadError.message);
                  return;
                }

                const { data: publicCover } = supabase.storage.from(MEDIA_IMAGES_BUCKET).getPublicUrl(coverImagePath);
                nextValues.coverImageUrl = publicCover.publicUrl;
                nextValues.coverImagePath = coverImagePath;
              }

              if (previewFile) {
                const hasAllowedMimeType = PREVIEW_ALLOWED_MIME_TYPES.includes(previewFile.type as (typeof PREVIEW_ALLOWED_MIME_TYPES)[number]);
                const hasAllowedExtension = hasAllowedPreviewExtension(previewFile.name);

                if (!hasAllowedMimeType || !hasAllowedExtension) {
                  setStatusMessage("Preview file must be MP3, WAV, or M4A.");
                  return;
                }

                if (previewFile.size > PREVIEW_MAX_SIZE_BYTES) {
                  setStatusMessage("Preview file is too large. Max size is 20 MB.");
                  return;
                }

                const previewPath = buildBeatPreviewStoragePath(editingBeatId ?? values.slug, previewFile.name);
                const { error: previewUploadError } = await supabase.storage.from(BEAT_PREVIEWS_BUCKET).upload(previewPath, previewFile, {
                  upsert: true,
                  contentType: previewFile.type || undefined,
                });

                if (previewUploadError) {
                  setStatusMessage(previewUploadError.message);
                  return;
                }

                const { data: publicPreview } = supabase.storage.from(BEAT_PREVIEWS_BUCKET).getPublicUrl(previewPath);
                nextValues.previewUrl = publicPreview.publicUrl;
                nextValues.previewStoragePath = previewPath;
                nextValues.previewFileName = previewFile.name;
                nextValues.previewMimeType = previewFile.type || "audio/mpeg";
                nextValues.previewSizeBytes = previewFile.size;
              }

              if (wavFile) {
                const wavPath = buildStoragePath(values.slug, "wav", wavFile.name);
                const { error: wavUploadError } = await supabase.storage.from(BEAT_DOWNLOADS_BUCKET).upload(wavPath, wavFile, {
                  upsert: true,
                  contentType: wavFile.type || undefined,
                });

                if (wavUploadError) {
                  setStatusMessage(wavUploadError.message);
                  return;
                }

                nextValues.wavFilePath = wavPath;
              }

              if (zipFile) {
                const zipPath = buildStoragePath(values.slug, "zip", zipFile.name);
                const { error: zipUploadError } = await supabase.storage.from(BEAT_DOWNLOADS_BUCKET).upload(zipPath, zipFile, {
                  upsert: true,
                  contentType: zipFile.type || undefined,
                });

                if (zipUploadError) {
                  setStatusMessage(zipUploadError.message);
                  return;
                }

                nextValues.zipFilePath = zipPath;
              }
            } catch (error) {
              setStatusMessage(error instanceof Error ? error.message : "Upload failed.");
              return;
            }

            const endpoint = editingBeatId ? `/api/admin/beats/${editingBeatId}` : "/api/admin/beats";
            const method = editingBeatId ? "PUT" : "POST";

            const response = await fetch(endpoint, {
              method,
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(nextValues),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
              setStatusMessage(payload?.error ?? "Save failed.");
              return;
            }

            setStatusMessage(editingBeatId ? "Beat updated." : "Beat created.");
            setEditingBeatId(null);
            setIsSlugManuallyEdited(false);
            reset({
              ...defaultValues,
              caseNumber: getNextCaseNumber(beats),
            });
            setCoverImageFile(null);
            setPreviewFile(null);
            setWavFile(null);
            setZipFile(null);
            router.refresh();
          })}
        >
          <input type="hidden" {...register("coverImageUrl")} />
          <input type="hidden" {...register("coverImagePath")} />
          <input type="hidden" {...register("previewStoragePath")} />
          <input type="hidden" {...register("previewFileName")} />
          <input type="hidden" {...register("previewMimeType")} />
          <input type="hidden" {...register("previewSizeBytes")} />
          <input type="hidden" {...register("wavFilePath")} />
          <input type="hidden" {...register("zipFilePath")} />

          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Title</span>
            <input {...register("title")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.title ? <span className="text-xs text-[var(--color-alert)]">{errors.title.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <div className="flex items-center justify-between">
              <span>Slug</span>
              <button
                type="button"
                onClick={() => {
                  const currentTitle = watch("title");
                  const autoSlug = generateSlug(currentTitle);
                  setValue("slug", autoSlug, { shouldValidate: true, shouldDirty: true });
                  setIsSlugManuallyEdited(false);
                }}
                className="text-xs normal-case tracking-normal text-amber-400 hover:underline"
              >
                ⚡ Авто из названия (латиница)
              </button>
            </div>
            <input
              {...register("slug")}
              onChange={(e) => {
                setIsSlugManuallyEdited(true);
                register("slug").onChange(e);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
            />
            {errors.slug ? <span className="text-xs text-[var(--color-alert)]">{errors.slug.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <div className="flex items-center justify-between">
              <span>Case Number</span>
              <button
                type="button"
                onClick={() => {
                  const nextCase = getNextCaseNumber(beats);
                  setValue("caseNumber", nextCase, { shouldValidate: true, shouldDirty: true });
                }}
                className="text-xs normal-case tracking-normal text-amber-400 hover:underline"
              >
                ⚡ След. номер ({getNextCaseNumber(beats)})
              </button>
            </div>
            <input {...register("caseNumber")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.caseNumber ? <span className="text-xs text-[var(--color-alert)]">{errors.caseNumber.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Preview URL</span>
            <input {...register("previewUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.previewUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.previewUrl.message}</span> : null}
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              Optional public HTTPS URL. If you upload a preview file below, this field is filled automatically.
            </span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Cover Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setCoverImageFile(file);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {coverImageFile
                ? `Selected: ${coverImageFile.name}`
                : editingBeatId && beats.find((beat) => beat.id === editingBeatId)?.coverImagePath
                  ? "Stored in public image bucket."
                  : "Optional cover image for the public card."}
            </span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Preview File</span>
            <input
              type="file"
              accept=".mp3,audio/mpeg,audio/mp3,.wav,audio/wav,.m4a,audio/mp4,audio/x-m4a"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setPreviewFile(file);
                if (file) {
                  const hasAllowedMimeType = PREVIEW_ALLOWED_MIME_TYPES.includes(file.type as (typeof PREVIEW_ALLOWED_MIME_TYPES)[number]);
                  const hasAllowedExtension = hasAllowedPreviewExtension(file.name);

                  if (!hasAllowedMimeType || !hasAllowedExtension) {
                    setStatusMessage("Поддерживаются MP3/WAV/M4A. Предпочтительно MP3.");
                    setPreviewFile(null);
                    return;
                  }

                  if (file.size > PREVIEW_MAX_SIZE_BYTES) {
                    setStatusMessage("Файл превью слишком большой. Лимит 20 MB.");
                    setPreviewFile(null);
                    return;
                  }

                  setValue("previewFileName", file.name, { shouldValidate: true, shouldDirty: true });
                  setValue("previewMimeType", file.type || "audio/mpeg", { shouldValidate: true, shouldDirty: true });
                  setValue("previewSizeBytes", file.size, { shouldValidate: true, shouldDirty: true });
                  setStatusMessage("Анализирую аудио...");
                  void analyzeAudioFile(file)
                    .then((analysis) => {
                      setValue("duration", analysis.formattedDuration, { shouldValidate: true, shouldDirty: true });

                      if (analysis.bpm !== null) {
                        setValue("bpm", analysis.bpm, { shouldValidate: true, shouldDirty: true });
                        setStatusMessage(`Определено: ${analysis.bpm} BPM / ${analysis.formattedDuration}`);
                        return;
                      }

                      setStatusMessage(`Длительность определена автоматически: ${analysis.formattedDuration}. BPM уточни вручную.`);
                    })
                    .catch((error) => {
                      setStatusMessage(error instanceof Error ? error.message : "Не удалось проанализировать аудио.");
                    });
                }
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {previewFile
                ? `Selected: ${previewFile.name}`
                : activeBeat?.previewStoragePath
                  ? "Stored in Supabase previews bucket."
                  : "Upload optional preview audio for player and Telegram."}
            </span>
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              Supported: {PREVIEW_ALLOWED_EXTENSIONS.join(", ")} (max {Math.floor(PREVIEW_MAX_SIZE_BYTES / (1024 * 1024))} MB).
            </span>
            {errors.previewMimeType ? <span className="text-xs text-[var(--color-alert)]">{errors.previewMimeType.message}</span> : null}
            {errors.previewSizeBytes ? <span className="text-xs text-[var(--color-alert)]">{errors.previewSizeBytes.message}</span> : null}
            {activeBeat?.previewUrl ? (
              <div className="space-y-2 pt-2">
                <audio controls preload="none" src={activeBeat.previewUrl} className="w-full" />
                <a href={activeBeat.previewUrl} target="_blank" rel="noreferrer" className="text-xs normal-case tracking-normal text-[var(--color-paper-400)] underline underline-offset-4">
                  Open current preview URL
                </a>
              </div>
            ) : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Cover Palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.coverPalette ? <span className="text-xs text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Genre</span>
            <select {...register("genre")} className="w-full border border-[var(--color-line)] bg-[rgba(20,17,15,0.95)] px-4 py-3">
              {BEAT_GENRES.map((genre) => (
                <option key={genre} value={genre}>
                  {getGenreLabel(genre, "en")}
                </option>
              ))}
            </select>
            {errors.genre ? <span className="text-xs text-[var(--color-alert)]">{errors.genre.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Substyle</span>
            <select {...register("substyle")} className="w-full border border-[var(--color-line)] bg-[rgba(20,17,15,0.95)] px-4 py-3">
              {substyleOptions.map((substyle) => (
                <option key={substyle} value={substyle}>
                  {substyle}
                </option>
              ))}
            </select>
            {errors.substyle ? <span className="text-xs text-[var(--color-alert)]">{errors.substyle.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Mood</span>
            <select {...register("mood")} className="w-full border border-[var(--color-line)] bg-[rgba(20,17,15,0.95)] px-4 py-3">
              {BEAT_MOODS.map((mood) => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
            </select>
            {errors.mood ? <span className="text-xs text-[var(--color-alert)]">{errors.mood.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>BPM</span>
            <input
              type="number"
              {...register("bpm", { valueAsNumber: true })}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
            />
            {errors.bpm ? <span className="text-xs text-[var(--color-alert)]">{errors.bpm.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Price USD</span>
            <input
              type="number"
              {...register("priceUsd", { valueAsNumber: true })}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
            />
            {errors.priceUsd ? <span className="text-xs text-[var(--color-alert)]">{errors.priceUsd.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Price RUB</span>
            <input
              type="number"
              {...register("priceRub", { valueAsNumber: true })}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
            />
            {errors.priceRub ? <span className="text-xs text-[var(--color-alert)]">{errors.priceRub.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Duration</span>
            <input {...register("duration")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.duration ? <span className="text-xs text-[var(--color-alert)]">{errors.duration.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Status</span>
            <select {...register("status")} className="w-full border border-[var(--color-line)] bg-[rgba(20,17,15,0.95)] px-4 py-3">
              <option value="available">available (В продаже на витрине)</option>
              <option value="sold">sold (Продан — скрыт с витрины)</option>
              <option value="reserved">reserved (В резерве)</option>
              <option value="private">private (Приватный)</option>
            </select>
            {watchedStatus === "sold" ? (
              <span className="block border border-red-800/80 bg-red-950/40 p-2.5 text-xs normal-case tracking-normal text-red-300">
                🔴 Бит помечен как ПРОДАН. Он будет полностью скрыт с публичной витрины и страницы каталога.
              </span>
            ) : null}
          </label>
          <label className="flex items-center gap-3 pt-9 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("featured")} className="h-4 w-4" />
            <span>Featured</span>
          </label>
          <label className="flex items-center gap-3 pt-9 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("availableForDownload")} className="h-4 w-4" />
            <span>Allow MP3 Download</span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>WAV File</span>
            <input
              type="file"
              accept=".wav,audio/wav"
              onChange={(event) => {
                setWavFile(event.target.files?.[0] ?? null);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {wavFile
                ? `Selected: ${wavFile.name}`
                : editingBeatId && beats.find((beat) => beat.id === editingBeatId)?.wavFilePath
                  ? "Stored as a private sale asset."
                  : "Private WAV for post-purchase delivery."}
            </span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>ZIP File</span>
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => {
                setZipFile(event.target.files?.[0] ?? null);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {zipFile
                ? `Selected: ${zipFile.name}`
                : editingBeatId && beats.find((beat) => beat.id === editingBeatId)?.zipFilePath
                  ? "Stored as a private archive bundle."
                  : "Private ZIP for stems or full sale package."}
            </span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Description</span>
            <textarea {...register("description")} rows={4} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.description ? <span className="text-xs text-[var(--color-alert)]">{errors.description.message}</span> : null}
          </label>

          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving" : editingBeatId ? "Save Changes" : "Create Beat"}
            </Button>
            {statusMessage ? <span className="text-sm text-[var(--color-paper-200)]">{statusMessage}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Existing Beats"
        description="Preview streams publicly; WAV and ZIP stay private in storage for the purchase flow."
        columns={["Playback", "Title", "Cover", "Preview", "WAV", "ZIP", "BPM", "Style / Mood", "Price", "Status", "Actions"]}
        rows={rows}
      />
    </div>
  );
}