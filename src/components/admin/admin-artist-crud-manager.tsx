"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { artistFormSchema, type ArtistFormValues } from "@/lib/validations/artist";
import type { Artist } from "@/types";

const defaultValues: ArtistFormValues = {
  artistName: "",
  trackTitle: "",
  beatTitle: "",
  coverPalette: "from-slate-700 via-zinc-900 to-black",
  spotifyUrl: "https://open.spotify.com/",
  appleMusicUrl: "https://music.apple.com/",
  youtubeUrl: "https://youtube.com/",
};

export function AdminArtistCrudManager({ artists, hasSupabase }: { artists: Artist[]; hasSupabase: boolean }) {
  const router = useRouter();
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ArtistFormValues>({
    resolver: zodResolver(artistFormSchema),
    defaultValues,
  });

  const rows = useMemo(
    () =>
      artists.map((artist) => [
        artist.artistName,
        artist.trackTitle,
        artist.beatTitle,
        <div key={`actions-${artist.id}`} className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEditingArtistId(artist.id);
              setValue("artistName", artist.artistName);
              setValue("trackTitle", artist.trackTitle);
              setValue("beatTitle", artist.beatTitle);
              setValue("coverPalette", artist.coverPalette);
              setValue("spotifyUrl", artist.spotifyUrl);
              setValue("appleMusicUrl", artist.appleMusicUrl);
              setValue("youtubeUrl", artist.youtubeUrl);
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

              if (!window.confirm(`Delete ${artist.artistName}?`)) {
                return;
              }

              const response = await fetch(`/api/admin/artists/${artist.id}`, { method: "DELETE" });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setStatusMessage(payload?.error ?? "Delete failed.");
                return;
              }

              setStatusMessage("Artist deleted.");
              if (editingArtistId === artist.id) {
                setEditingArtistId(null);
                reset(defaultValues);
              }
              router.refresh();
            }}
          >
            Delete
          </Button>
        </div>,
      ]),
    [artists, hasSupabase, editingArtistId, reset, router, setValue],
  );

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Supabase CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Artists Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Каталог артистов и их стриминг-ссылки теперь можно вести через admin flow с Supabase-backed API.
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
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
              {editingArtistId ? "Edit Artist" : "Create Artist"}
            </p>
            <h2 className="mt-2 font-sans text-4xl uppercase tracking-[0.05em]">Artist Record</h2>
          </div>
          {editingArtistId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingArtistId(null);
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

            const endpoint = editingArtistId ? `/api/admin/artists/${editingArtistId}` : "/api/admin/artists";
            const method = editingArtistId ? "PUT" : "POST";

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

            setStatusMessage(editingArtistId ? "Artist updated." : "Artist created.");
            setEditingArtistId(null);
            reset(defaultValues);
            router.refresh();
          })}
        >
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Artist Name</span>
            <input {...register("artistName")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.artistName ? <span className="text-xs text-[var(--color-alert)]">{errors.artistName.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Track Title</span>
            <input {...register("trackTitle")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.trackTitle ? <span className="text-xs text-[var(--color-alert)]">{errors.trackTitle.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Beat Title</span>
            <input {...register("beatTitle")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.beatTitle ? <span className="text-xs text-[var(--color-alert)]">{errors.beatTitle.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Cover Palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.coverPalette ? <span className="text-xs text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Spotify URL</span>
            <input {...register("spotifyUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.spotifyUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.spotifyUrl.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Apple Music URL</span>
            <input {...register("appleMusicUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.appleMusicUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.appleMusicUrl.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>YouTube URL</span>
            <input {...register("youtubeUrl")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.youtubeUrl ? <span className="text-xs text-[var(--color-alert)]">{errors.youtubeUrl.message}</span> : null}
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving" : editingArtistId ? "Save Changes" : "Create Artist"}
            </Button>
            {statusMessage ? <span className="text-sm text-[var(--color-paper-200)]">{statusMessage}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Existing Artists"
        description="Artist entries подгружаются из Supabase с fallback на mock data, если env ещё не настроены."
        columns={["Artist", "Track", "Beat", "Actions"]}
        rows={rows}
      />
    </div>
  );
}