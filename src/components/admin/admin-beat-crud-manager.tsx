"use client";

import { useEffect, useMemo, useState } from "react";
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
    setEditingId(null);
    setSlugTouched(false);
    reset({ ...DEFAULTS, caseNumber: getNextCaseNumber(beats) });
  };

  const startEdit = (beat: AdminBeat) => {
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

    if (payload.title.length < 2 || payload.slug.length < 2 || payload.caseNumber.length < 2) {
      setMessage("Title, slug and case number are required.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
      setMessage("Slug must be lowercase latin words separated by single hyphens.");
      return;
    }

    const endpoint = editingId ? `/api/admin/beats/${editingId}` : "/api/admin/beats";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { error?: string; beat?: { id: string; slug: string } } | null;

    if (!response.ok) {
      setMessage(body?.error ?? `Save failed (${response.status}).`);
      return;
    }

    setMessage(editingId ? "Beat updated." : `Beat created (${body?.beat?.id ?? "id"}). It is PRIVATE until files are attached in the next phase.`);
    resetForm();
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
    setMessage(response.ok ? `Status → ${status}.` : body?.error ?? "Status update failed.");
    if (response.ok) router.refresh();
  };

  const removeBeat = async (beat: AdminBeat) => {
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
          <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => startEdit(beat)}>Edit</Button>
          <Button variant="alert" className="px-2.5 py-1 text-xs" onClick={() => removeBeat(beat)}>Delete</Button>
        </div>,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beats, editingId],
  );

  const field = "w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3";
  const label = "space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]";

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">PostgreSQL CRUD</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Beats Admin</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
          Metadata is stored in PostgreSQL. A new beat is created <strong>PRIVATE</strong>; cover / preview / master / archive
          files attach through the verified Contabo upload flow in the next phase.
        </p>
      </section>

      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-sans text-4xl uppercase tracking-[0.05em]">{editingId ? "Edit Beat" : "Create Beat"}</h2>
          {editingId ? <Button variant="ghost" onClick={resetForm}>Cancel edit</Button> : null}
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className={label}>
            <span>Title</span>
            <input {...register("title")} className={field} />
            {errors.title ? <span className="text-xs text-[var(--color-alert)]">{errors.title.message}</span> : null}
          </label>
          <label className={label}>
            <span>Slug</span>
            <input {...register("slug")} onChange={(e) => { setSlugTouched(true); register("slug").onChange(e); }} className={field} />
          </label>
          <label className={label}>
            <span>Case number</span>
            <input {...register("caseNumber")} className={field} />
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
              {BEAT_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <p className="mt-2">Cover, preview, master (WAV) and archive (ZIP) upload is delivered in the next phase (Contabo direct upload). This form saves metadata only.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              {["Cover", "Preview", "WAV", "ZIP"].map((name) => (
                <input key={name} type="file" disabled title="Подключение Contabo выполняется следующим этапом" className="w-full cursor-not-allowed border border-[var(--color-line)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-xs opacity-50" />
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving" : editingId ? "Save changes" : "Create beat"}</Button>
            {message ? <span className="text-sm text-[var(--color-paper-200)]">{message}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Existing beats"
        description="Metadata from PostgreSQL. Private beats are hidden from the public catalogue."
        columns={["Play", "Title", "Cover", "Preview", "WAV", "ZIP", "BPM", "Price", "Status", "Actions"]}
        rows={rows}
      />
    </div>
  );
}
