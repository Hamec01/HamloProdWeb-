"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminBeatPlayButton } from "@/components/admin/admin-beat-play-button";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { beatFormSchema, type BeatFormValues } from "@/lib/validations/beat";
import type { Beat } from "@/types";

const defaultValues: BeatFormValues = {
  title: "",
  slug: "",
  caseNumber: "",
  coverPalette: "from-stone-700 via-stone-900 to-zinc-950",
  previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  bpm: 90,
  mood: "Dark / Atmospheric",
  description: "Beat description goes here.",
  duration: "02:30",
  status: "available",
  priceUsd: 100,
  featured: false,
};

export function AdminBeatCrudManager({ beats, hasSupabase }: { beats: Beat[]; hasSupabase: boolean }) {
  const router = useRouter();
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BeatFormValues>({
    resolver: zodResolver(beatFormSchema),
    defaultValues,
  });

  const modeLabel = editingBeatId ? "Edit Beat" : "Create Beat";

  const rows = useMemo(
    () =>
      beats.map((beat) => [
        <AdminBeatPlayButton key={`play-${beat.id}`} beat={beat} />,
        beat.title,
        String(beat.bpm),
        beat.mood,
        beat.status,
        <div key={`actions-${beat.id}`} className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEditingBeatId(beat.id);
              setValue("title", beat.title);
              setValue("slug", beat.slug);
              setValue("caseNumber", beat.caseNumber);
              setValue("coverPalette", beat.coverPalette);
              setValue("previewUrl", beat.previewUrl);
              setValue("bpm", beat.bpm);
              setValue("mood", beat.mood);
              setValue("description", beat.description);
              setValue("duration", beat.duration);
              setValue("status", beat.status);
              setValue("priceUsd", beat.priceUsd);
              setValue("featured", beat.featured);
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
                reset(defaultValues);
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
            <Button
              variant="ghost"
              onClick={() => {
                setEditingBeatId(null);
                reset(defaultValues);
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

            const endpoint = editingBeatId ? `/api/admin/beats/${editingBeatId}` : "/api/admin/beats";
            const method = editingBeatId ? "PUT" : "POST";

            const response = await fetch(endpoint, {
              method,
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(values),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
              setStatusMessage(payload?.error ?? "Save failed.");
              return;
            }

            setStatusMessage(editingBeatId ? "Beat updated." : "Beat created.");
            setEditingBeatId(null);
            reset(defaultValues);
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
            <span>Case Number</span>
            <input {...register("caseNumber")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.caseNumber ? <span className="text-xs text-[var(--color-alert)]">{errors.caseNumber.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Preview URL</span>
            <input {...register("previewUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.previewUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.previewUrl.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Cover Palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.coverPalette ? <span className="text-xs text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Mood</span>
            <input {...register("mood")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
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
            <span>Duration</span>
            <input {...register("duration")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.duration ? <span className="text-xs text-[var(--color-alert)]">{errors.duration.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Status</span>
            <select {...register("status")} className="w-full border border-[var(--color-line)] bg-[rgba(20,17,15,0.95)] px-4 py-3">
              <option value="available">available</option>
              <option value="reserved">reserved</option>
              <option value="sold">sold</option>
              <option value="private">private</option>
            </select>
          </label>
          <label className="flex items-center gap-3 pt-9 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <input type="checkbox" {...register("featured")} className="h-4 w-4" />
            <span>Featured</span>
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
        description="Playback uses the same global audio player as the public archive."
        columns={["Playback", "Title", "BPM", "Mood", "Status", "Actions"]}
        rows={rows}
      />
    </div>
  );
}