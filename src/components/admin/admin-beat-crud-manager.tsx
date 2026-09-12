"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadBeatAsset } from "@/lib/storage/client-upload";
import type { BeatAssetKind } from "@/lib/data/repositories/upload-intent.repository";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { AdminBeatPlayButton } from "@/components/admin/admin-beat-play-button";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { BEAT_GENRES, BEAT_MOODS, BEAT_SUBSTYLES, getGenreLabel } from "@/lib/beats-taxonomy";
import { BEAT_STATUS_VALUES } from "@/lib/validations/beat";
import { generateSlug, getNextCaseNumber } from "@/lib/slug";
import type { AdminBeat, BeatGenre, BeatStatus } from "@/types/beat";

type FormShape = {
  title: string;
  slug: string;
  caseNumber: string;
  coverPalette: string;
  genre: BeatGenre;
  substyle: string;
  mood: string;
  description: string;
  bpm: string;
  duration: string; // MM:SS
  priceUsd: number;
  priceRub: number;
  status: BeatStatus;
  featured: boolean;
  availableForDownload: boolean;
};

const DEFAULTS: FormShape = {
  title: "",
  slug: "",
  caseNumber: "",
  coverPalette: "from-stone-700 via-stone-900 to-zinc-950",
  genre: "boombap",
  substyle: "Classic",
  mood: "Melancholic",
  description: "",
  bpm: "",
  duration: "",
  priceUsd: 100,
  priceRub: 2500,
  status: "private",
  featured: false,
  availableForDownload: false,
};

function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(trimmed);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function buildPayload(values: FormShape) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    caseNumber: values.caseNumber.trim(),
    coverPalette: values.coverPalette.trim(),
    genre: values.genre,
    substyle: values.substyle.trim() || null,
    mood: values.mood.trim() || null,
    description: values.description.trim() || null,
    bpm: values.bpm.trim() === "" ? null : Number(values.bpm),
    durationSeconds: parseDuration(values.duration),
    priceUsd: Math.trunc(values.priceUsd),
    priceRub: Math.trunc(values.priceRub),
    status: values.status,
    featured: values.featured,
    availableForDownload: values.availableForDownload,
  };
}

export function AdminBeatCrudManager({ beats }: { beats: AdminBeat[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [assetBeat, setAssetBeat] = useState<AdminBeat | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<BeatAssetKind, File>>>({});
  const [uploading, setUploading] = useState<BeatAssetKind | null>(null);
  const [postingTelegramId, setPostingTelegramId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);

  const sendToTelegram = async (beatId: string): Promise<string | null> => {
    setPostingTelegramId(beatId);
    try {
      const response = await fetch(`/api/admin/beats/${beatId}/telegram`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return response.ok ? null : body?.error ?? `Telegram failed (${response.status}).`;
    } catch (error) {
      return error instanceof Error ? error.message : "Failed to publish beat to Telegram.";
    } finally {
      setPostingTelegramId(null);
    }
  };

  const postToTelegram = async (beatId: string) => {
    setMessage("Posting to Telegram…");
    const error = await sendToTelegram(beatId);
    setMessage(error ? `Telegram: ${error}` : "Beat posted to Telegram.");
  };

  const uploadFile = async (kind: BeatAssetKind, file: File) => {
    if (!editingId || uploadController.current) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(kind);
    setMessage(null);
    try {
      const beat = await uploadBeatAsset(editingId, kind, file, { signal: controller.signal, onProgress: setProgress });
      setAssetBeat(beat);
      setMessage("File attached.");
      router.refresh();
    } catch (error) {
      setMessage(controller.signal.aborted ? "Upload cancelled." : error instanceof Error ? error.message : "Upload failed.");
    } finally {
      uploadController.current = null;
      setUploading(null);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({ defaultValues: { ...DEFAULTS, caseNumber: getNextCaseNumber(beats) } });

  const selectedGenre = watch("genre");
  const watchedTitle = watch("title");
  const watchedStatus = watch("status");
  const substyleOptions = BEAT_SUBSTYLES[selectedGenre] ?? BEAT_SUBSTYLES.boombap;

  useEffect(() => {
    if (!editingId && !slugTouched && watchedTitle !== undefined) {
      setValue("slug", generateSlug(watchedTitle), { shouldValidate: true });
    }
  }, [watchedTitle, editingId, slugTouched, setValue]);

  useEffect(() => {
    if (!editingId) {
      setValue("caseNumber", getNextCaseNumber(beats), { shouldValidate: true });
    }
  }, [beats, editingId, setValue]);

  const resetForm = () => {
    if (uploadController.current) return;
    setAssetBeat(null);
    setPendingFiles({});
    setEditingId(null);
    setSlugTouched(false);
    reset({ ...DEFAULTS, caseNumber: getNextCaseNumber(beats) });
  };

  const startEdit = (beat: AdminBeat, preservePendingFiles = false) => {
    if (uploadController.current) return;
    setAssetBeat(beat);
    if (!preservePendingFiles) setPendingFiles({});
    setEditingId(beat.id);
    setSlugTouched(true);
    setMessage(null);
    reset({
      title: beat.title,
      slug: beat.slug,
      caseNumber: beat.caseNumber,
      coverPalette: beat.coverPalette,
      genre: beat.genre,
      substyle: beat.substyle ?? "",
      mood: beat.mood ?? "",
      description: beat.description ?? "",
      bpm: beat.bpm === null ? "" : String(beat.bpm),
      duration: formatDuration(beat.durationSeconds),
      priceUsd: beat.priceUsd,
      priceRub: beat.priceRub,
      status: beat.status,
      featured: beat.featured,
      availableForDownload: beat.availableForDownload,
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const payload = buildPayload(values);
    const creating = !editingId;
    const publishAfterCreate = creating && payload.status === "available";

    if (payload.title.length < 2 || payload.slug.length < 2 || payload.caseNumber.length < 2) {
      setMessage("Введите название бита сверху. Slug создастся автоматически, номер уже заполнен.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
      setMessage("Slug must be lowercase latin words separated by single hyphens.");
      return;
    }
    if (publishAfterCreate && (!pendingFiles["beat-cover"] || !pendingFiles["beat-preview"])) {
      setMessage("Для статуса available сначала выберите Cover и Preview. WAV и ZIP необязательны.");
      return;
    }

    const endpoint = editingId ? `/api/admin/beats/${editingId}` : "/api/admin/beats";
    const method = editingId ? "PATCH" : "POST";
    const savePayload = publishAfterCreate ? { ...payload, status: "private" as const } : payload;

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savePayload),
    });

    const body = (await response.json().catch(() => null)) as { error?: string; beat?: AdminBeat } | null;

    if (!response.ok) {
      setMessage(body?.error ?? `Save failed (${response.status}).`);
      return;
    }

    if (body?.beat) {
      const wasCreated = !editingId;
      startEdit(body.beat, wasCreated);

      if (wasCreated) {
        const files = Object.entries(pendingFiles) as Array<[BeatAssetKind, File]>;
        if (files.length > 0) {
          const controller = new AbortController();
          uploadController.current = controller;
          try {
            let latestBeat = body.beat;
            for (const [kind, file] of files) {
              setUploading(kind);
              setProgress(0);
              latestBeat = await uploadBeatAsset(body.beat.id, kind, file, {
                signal: controller.signal,
                onProgress: setProgress,
              });
              setAssetBeat(latestBeat);
            }
            setPendingFiles({});
            if (publishAfterCreate) {
              setMessage("Files attached. Publishing…");
              const publishResponse = await fetch(`/api/admin/beats/${body.beat.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "available" }),
              });
              const published = (await publishResponse.json().catch(() => null)) as { error?: string; beat?: AdminBeat } | null;
              if (!publishResponse.ok) {
                setMessage(published?.error ?? "Beat and files saved, but publishing failed.");
                return;
              }
              if (published?.beat) {
                latestBeat = published.beat;
                setAssetBeat(published.beat);
                setValue("status", published.beat.status, { shouldDirty: false });
              }
              setMessage("Beat created, files attached and published. Use the Telegram button below to post it.");
            } else {
              setMessage("Beat created and selected files attached. Add any remaining files, then publish.");
            }
          } catch (error) {
            setMessage(
              controller.signal.aborted
                ? "Beat created. Upload cancelled; you can select the file again."
                : `Beat created, but a file failed to upload: ${error instanceof Error ? error.message : "Upload failed."}`,
            );
          } finally {
            uploadController.current = null;
            setUploading(null);
          }
        } else {
          setMessage("Beat created. Upload cover and preview, then publish.");
        }
      } else {
        setMessage("Beat updated.");
      }
    }
    router.refresh();
  });

  const quickStatus = async (id: string, status: BeatStatus) => {
    setMessage("Updating status…");
    const response = await fetch(`/api/admin/beats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? "Status update failed.");
      return;
    }
    setMessage(status === "available" ? "Published. Use the Telegram button to post it." : `Status → ${status}.`);
    router.refresh();
  };

  const removeBeat = async (beat: AdminBeat) => {
    if (uploadController.current) return;
    if (!window.confirm(`Delete "${beat.title}"?`)) return;
    const response = await fetch(`/api/admin/beats/${beat.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? "Delete failed.");
      return;
    }
    setMessage("Beat deleted.");
    if (editingId === beat.id) resetForm();
    router.refresh();
  };

  const rows = useMemo(
    () =>
      beats.map((beat) => [
        <AdminBeatPlayButton key={`play-${beat.id}`} beat={beat} />,
        <div key={`t-${beat.id}`} className="space-y-0.5">
          <div className="font-medium text-[var(--color-paper-100)]">{beat.title}</div>
          <div className="text-[11px] text-[var(--color-paper-400)]">{beat.caseNumber} • {beat.slug}</div>
        </div>,
        beat.hasCover ? "cover" : "—",
        beat.hasPreview ? "preview" : "—",
        beat.hasMaster ? "wav" : "—",
        beat.hasArchive ? "zip" : "—",
        beat.bpm ?? "—",
        `$${beat.priceUsd} / ₽${beat.priceRub}`,
        <span key={`s-${beat.id}`} className="text-[11px] uppercase tracking-wider">{beat.status}{beat.publishedAt ? "" : " (unpublished)"}</span>,
        <div key={`a-${beat.id}`} className="flex items-center gap-2 whitespace-nowrap">
          {beat.status === "available" ? (
            <Button variant="alert" className="px-2.5 py-1 text-xs" onClick={() => quickStatus(beat.id, "private")}>Hide</Button>
          ) : beat.status === "private" ? (
            <Button variant="primary" className="px-2.5 py-1 text-xs" onClick={() => quickStatus(beat.id, "available")}>Publish</Button>
          ) : null}
          {beat.status === "available" ? (
            <Button
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              disabled={postingTelegramId === beat.id}
              onClick={() => postToTelegram(beat.id)}
            >
              {postingTelegramId === beat.id ? "Posting…" : "Telegram"}
            </Button>
          ) : null}
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => startEdit(beat)}>Edit</Button>
          <Button variant="alert" className="px-2.5 py-1 text-xs" onClick={() => removeBeat(beat)}>Delete</Button>
        </div>,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beats, editingId, postingTelegramId],
  );

  const field = "w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3";
  const label = "space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]";

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Catalogue management</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Beats Admin</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
          Create a private beat, upload its files, then publish once the cover and preview are ready.
        </p>
      </section>

      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-sans text-4xl uppercase tracking-[0.05em]">{editingId ? "Edit Beat" : "Create Beat"}</h2>
            <p className="mt-2 text-sm text-[var(--color-paper-300)]">
              {editingId
                ? "Загрузите или замените файлы, затем опубликуйте бит в списке ниже."
                : "Заполните данные, выберите файлы и нажмите «Создать бит». Для публикации сразу выберите available."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {editingId ? <Button variant="ghost" onClick={resetForm} disabled={Boolean(uploading)}>Cancel edit</Button> : null}
            <Button type="submit" form="admin-beat-form" disabled={isSubmitting || Boolean(uploading)}>
              {isSubmitting ? "Saving" : editingId ? "Save changes" : "Создать бит"}
            </Button>
          </div>
        </div>

        <form id="admin-beat-form" className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className={label}>
            <span>Title</span>
            <input {...register("title")} required className={field} />
            {errors.title ? <span className="text-xs text-[var(--color-alert)]">{errors.title.message}</span> : null}
          </label>
          <label className={label}>
            <span>Slug</span>
            <input {...register("slug")} required onChange={(e) => { setSlugTouched(true); register("slug").onChange(e); }} className={field} />
          </label>
          <label className={label}>
            <span>Case number</span>
            <input {...register("caseNumber")} required className={field} />
          </label>
          <label className={label}>
            <span>Cover palette (Tailwind gradient)</span>
            <input {...register("coverPalette")} className={field} />
          </label>
          <label className={label}>
            <span>Genre</span>
            <select {...register("genre")} className={field}>
              {BEAT_GENRES.map((g) => <option key={g} value={g}>{getGenreLabel(g, "en")}</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Substyle</span>
            <select {...register("substyle")} className={field}>
              {substyleOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className={label}>
            <span>Mood</span>
            <select {...register("mood")} className={field}>
              {BEAT_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className={label}>
            <span>BPM (optional)</span>
            <input type="number" inputMode="numeric" {...register("bpm")} className={field} />
          </label>
          <label className={label}>
            <span>Duration MM:SS (optional)</span>
            <input {...register("duration")} placeholder="02:30" className={field} />
          </label>
          <label className={label}>
            <span>Price USD</span>
            <input type="number" {...register("priceUsd", { valueAsNumber: true })} className={field} />
          </label>
          <label className={label}>
            <span>Price RUB</span>
            <input type="number" {...register("priceRub", { valueAsNumber: true })} className={field} />
          </label>
          <label className={label}>
            <span>Status</span>
            <select {...register("status")} className={field}>
              {BEAT_STATUS_VALUES.map((s) => (
                <option key={s} value={s} disabled={!editingId && (s === "reserved" || s === "sold")}>{s}</option>
              ))}
            </select>
            {watchedStatus === "private" ? (
              <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">Hidden from the public catalogue.</span>
            ) : null}
          </label>
          <label className="flex items-center gap-3 pt-9 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("featured")} className="h-4 w-4" />
            <span>Featured</span>
          </label>
          <label className="flex items-center gap-3 pt-9 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("availableForDownload")} className="h-4 w-4" />
            <span>Allow MP3 download</span>
          </label>
          <label className={`${label} md:col-span-2`}>
            <span>Description (optional)</span>
            <textarea {...register("description")} rows={3} className={field} />
          </label>

          <div className="md:col-span-2 border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[var(--color-paper-300)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper-400)]">Files</p>
            <p className="mt-2">{editingId ? "Choose a file to upload or replace an asset. WAV and ZIP remain private." : "Выберите файлы сейчас — они загрузятся автоматически после создания бита."}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {([
                ["beat-cover", "Cover", ".jpg,.jpeg,.png,.webp", assetBeat?.hasCover],
                ["beat-preview", "Preview", ".mp3", assetBeat?.hasPreview],
                ["beat-master", "WAV", ".wav", assetBeat?.hasMaster],
                ["beat-archive", "ZIP", ".zip", assetBeat?.hasArchive],
              ] as const).map(([kind, name, accept, attached]) => (
                <label key={kind} className="space-y-2">
                  <span>{name}: {attached ? "Attached" : pendingFiles[kind] ? `Selected: ${pendingFiles[kind]?.name}` : "Missing"}</span>
                  <input type="file" accept={accept} disabled={Boolean(uploading) || isSubmitting}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (editingId) {
                        event.target.value = "";
                        void uploadFile(kind, file);
                      } else {
                        setPendingFiles(current => ({ ...current, [kind]: file }));
                      }
                    }}
                    className="w-full border border-[var(--color-line)] px-3 py-2 text-xs disabled:opacity-50" />
                </label>
              ))}
            </div>
            {uploading ? <div className="mt-3 flex items-center gap-3" role="status">
              <progress value={progress} max={100} aria-label="Upload progress" />
              <span>{progress === 100 ? "Verifying and attaching…" : `${progress}%`}</span>
              <Button type="button" variant="ghost" onClick={() => uploadController.current?.abort()}>Cancel upload</Button>
            </div> : null}
            {assetBeat?.coverImageUrl ? <a className="mt-3 block underline" href={assetBeat.coverImageUrl} target="_blank" rel="noreferrer">View cover</a> : null}
            {assetBeat?.previewUrl ? <audio className="mt-3 w-full" controls src={assetBeat.previewUrl} preload="none" aria-label="Beat preview" /> : null}
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting || Boolean(uploading)}>{isSubmitting ? "Saving" : editingId ? "Save changes" : "Create beat"}</Button>
            {message ? <span className="text-sm text-[var(--color-paper-200)]">{message}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Existing beats"
        description="Private beats are hidden from the public catalogue."
        columns={["Play", "Title", "Cover", "Preview", "WAV", "ZIP", "BPM", "Price", "Status", "Actions"]}
        rows={rows}
      />
    </div>
  );
}
