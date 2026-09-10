"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminCollectionTable } from "@/components/admin/admin-collection-table";
import { Button } from "@/components/ui/button";
import { uploadAdminAsset } from "@/lib/storage/client-upload";
import { trackFormSchema, type TrackFormValues } from "@/lib/validations/track";
import type { Track, TrackDownloadLog } from "@/types";

const defaultValues: TrackFormValues = {
  title: "",
  slug: "",
  artistName: "HaM",
  coverPalette: "from-zinc-800 via-stone-900 to-black",
  coverImageUrl: null,
  coverImagePath: null,
  mp3FilePath: null,
  spotifyUrl: "",
  appleMusicUrl: "",
  youtubeUrl: "",
  releaseDate: "2026-01-01",
  isDemo: false,
};

export function AdminTrackCrudManager({
  tracks,
  downloadLogs,
}: {
  tracks: Track[];
  downloadLogs: TrackDownloadLog[];
}) {
  const router = useRouter();
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [mp3File, setMp3File] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TrackFormValues>({
    resolver: zodResolver(trackFormSchema),
    defaultValues,
  });

  const rows = useMemo(
    () =>
      tracks.map((track) => [
        track.title,
        track.artistName,
        track.isDemo ? "DEMO" : "sgl",
        track.coverImagePath ? "ready" : "palette",
        track.mp3FilePath ? "ready" : "missing",
        track.releaseDate,
        <div key={`actions-${track.id}`} className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEditingTrackId(track.id);
              setValue("title", track.title);
              setValue("slug", track.slug);
              setValue("artistName", track.artistName);
              setValue("coverPalette", track.coverPalette);
              setValue("coverImageUrl", track.coverImageUrl);
              setValue("coverImagePath", track.coverImagePath);
              setValue("mp3FilePath", track.mp3FilePath);
              setValue("spotifyUrl", track.spotifyUrl);
              setValue("appleMusicUrl", track.appleMusicUrl);
              setValue("youtubeUrl", track.youtubeUrl);
              setValue("releaseDate", track.releaseDate);
              setValue("isDemo", track.isDemo);
              setCoverImageFile(null);
              setMp3File(null);
              setStatusMessage(null);
            }}
          >
            Edit
          </Button>
          <Button
            variant="alert"
            onClick={async () => {
              if (!window.confirm(`Delete ${track.title}?`)) {
                return;
              }

              const response = await fetch(`/api/admin/tracks/${track.id}`, { method: "DELETE" });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setStatusMessage(payload?.error ?? "Delete failed.");
                return;
              }

              setStatusMessage("Track deleted.");
              if (editingTrackId === track.id) {
                setEditingTrackId(null);
                reset(defaultValues);
                setCoverImageFile(null);
                setMp3File(null);
              }
              router.refresh();
            }}
          >
            Delete
          </Button>
        </div>,
      ]),
    [tracks, editingTrackId, reset, router, setValue],
  );

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">PostgreSQL CRUD</p>
            <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Tracks Admin</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
              Управление релизами HaM и ссылками на платформы.
            </p>
          </div>
        </div>
      </section>

      <section className="case-panel p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
              {editingTrackId ? "Edit Track" : "Create Track"}
            </p>
            <h2 className="mt-2 font-sans text-4xl uppercase tracking-[0.05em]">Track Record</h2>
          </div>
          {editingTrackId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingTrackId(null);
                reset(defaultValues);
                setCoverImageFile(null);
                setMp3File(null);
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
            setStatusMessage(null);
            const nextValues: TrackFormValues = { ...values };

            try {
              // Metadata first so uploads have a stable entity id for the object key.
              let trackId = editingTrackId;
              if (!trackId) {
                const createRes = await fetch("/api/admin/tracks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(nextValues),
                });
                const created = (await createRes.json().catch(() => null)) as { id?: string; error?: string } | null;
                if (!createRes.ok || !created?.id) {
                  setStatusMessage(created?.error ?? "Save failed.");
                  return;
                }
                trackId = created.id;
              }

              if (coverImageFile) {
                setStatusMessage("Uploading cover…");
                const { key, publicUrl } = await uploadAdminAsset("track-cover", trackId, coverImageFile);
                nextValues.coverImagePath = key;
                nextValues.coverImageUrl = publicUrl;
              }
              if (mp3File) {
                setStatusMessage("Uploading MP3…");
                const { key } = await uploadAdminAsset("track-audio", trackId, mp3File);
                nextValues.mp3FilePath = key;
              }

              const saveRes = await fetch(`/api/admin/tracks/${trackId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nextValues),
              });
              const saved = (await saveRes.json().catch(() => null)) as { error?: string } | null;
              if (!saveRes.ok) {
                setStatusMessage(saved?.error ?? "Save failed.");
                return;
              }
            } catch (error) {
              setStatusMessage(error instanceof Error ? error.message : "Upload failed.");
              return;
            }

            setStatusMessage(editingTrackId ? "Track updated." : "Track created.");
            setEditingTrackId(null);
            reset(defaultValues);
            setCoverImageFile(null);
            setMp3File(null);
            router.refresh();
          })}
        >
          <input type="hidden" {...register("coverImageUrl")} />
          <input type="hidden" {...register("coverImagePath")} />
          <input type="hidden" {...register("mp3FilePath")} />

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
            <span>Artist</span>
            <input {...register("artistName")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.artistName ? <span className="text-xs text-[var(--color-alert)]">{errors.artistName.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)]">
            <span>Release Date</span>
            <input type="date" {...register("releaseDate")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.releaseDate ? <span className="text-xs text-[var(--color-alert)]">{errors.releaseDate.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Cover Palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3" />
            {errors.coverPalette ? <span className="text-xs text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>Cover Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                setCoverImageFile(event.target.files?.[0] ?? null);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {coverImageFile
                ? `Selected: ${coverImageFile.name}`
                : editingTrackId && tracks.find((track) => track.id === editingTrackId)?.coverImagePath
                  ? "Stored in public image bucket."
                  : "Optional image for the public release card."}
            </span>
          </label>
          <label className="space-y-2 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <span>MP3 File</span>
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={(event) => {
                setMp3File(event.target.files?.[0] ?? null);
              }}
              className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm"
            />
            <span className="block text-xs normal-case tracking-normal text-[var(--color-paper-400)]">
              {mp3File
                ? `Selected: ${mp3File.name}`
                : editingTrackId && tracks.find((track) => track.id === editingTrackId)?.mp3FilePath
                  ? "Stored as a private free-download asset."
                  : "Optional free MP3 for registered users."}
            </span>
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
          <label className="flex cursor-pointer items-center gap-3 text-sm uppercase tracking-[0.16em] text-[var(--color-paper-200)] md:col-span-2">
            <input type="checkbox" {...register("isDemo")} className="h-4 w-4 accent-amber-500" />
            <span>Demo трек (не попадает в основную очередь HaM)</span>
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving" : editingTrackId ? "Save Changes" : "Create Track"}
            </Button>
            {statusMessage ? <span className="text-sm text-[var(--color-paper-200)]">{statusMessage}</span> : null}
          </div>
        </form>
      </section>

      <AdminCollectionTable
        title="Existing Tracks"
        description="Релизы из PostgreSQL."
        columns={["Title", "Artist", "Type", "Cover", "MP3", "Release Date", "Actions"]}
        rows={rows}
      />

      <AdminCollectionTable
        title="MP3 Download Log"
        description="Список зарегистрированных пользователей, которые скачали бесплатный MP3."
        columns={["Track", "User", "Downloaded At"]}
        rows={downloadLogs.map((log) => [log.trackTitle, log.userEmail, new Date(log.downloadedAt).toLocaleString("ru-RU")])}
      />
    </div>
  );
}