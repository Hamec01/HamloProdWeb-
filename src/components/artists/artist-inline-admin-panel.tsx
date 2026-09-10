"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/lib/i18n";
import { artistFormSchema, type ArtistFormValues } from "@/lib/validations/artist";
import type { Artist } from "@/types";

export function ArtistInlineAdminPanel({
  artist,
  locale,
}: {
  artist: Artist;
  locale: Locale;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ArtistFormValues>({
    resolver: zodResolver(artistFormSchema),
    defaultValues: {
      artistName: artist.artistName,
      trackTitle: artist.trackTitle,
      beatTitle: artist.beatTitle,
      coverPalette: artist.coverPalette,
      spotifyUrl: artist.spotifyUrl,
      appleMusicUrl: artist.appleMusicUrl,
      youtubeUrl: artist.youtubeUrl,
    },
  });

  return (
    <section className="case-panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-400)]">
          {locale === "ru" ? "Быстрое редактирование" : "Quick Edit"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setIsOpen((prev) => !prev)}>
            {isOpen ? (locale === "ru" ? "Скрыть" : "Hide") : (locale === "ru" ? "Редактировать артиста" : "Edit Artist")}
          </Button>
          <Button
            variant="alert"
            onClick={async () => {

              if (!window.confirm(locale === "ru" ? `Удалить артиста ${artist.artistName}?` : `Delete ${artist.artistName}?`)) {
                return;
              }

              const response = await fetch(`/api/admin/artists/${artist.id}`, { method: "DELETE" });
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;

              if (!response.ok) {
                setStatusMessage(payload?.error ?? (locale === "ru" ? "Ошибка удаления." : "Delete failed."));
                return;
              }

              router.push(`/${locale}/artists`);
              router.refresh();
            }}
          >
            {locale === "ru" ? "Удалить" : "Delete"}
          </Button>
        </div>
      </div>

      {isOpen ? (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={handleSubmit(async (values) => {

            setStatusMessage(null);
            const response = await fetch(`/api/admin/artists/${artist.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
              setStatusMessage(payload?.error ?? (locale === "ru" ? "Ошибка сохранения." : "Save failed."));
              return;
            }

            setStatusMessage(locale === "ru" ? "Артист обновлен." : "Artist updated.");
            router.refresh();
          })}
        >
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            <span>Artist Name</span>
            <input {...register("artistName")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.artistName ? <span className="text-[11px] text-[var(--color-alert)]">{errors.artistName.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            <span>Track Title</span>
            <input {...register("trackTitle")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.trackTitle ? <span className="text-[11px] text-[var(--color-alert)]">{errors.trackTitle.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            <span>Beat Title</span>
            <input {...register("beatTitle")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.beatTitle ? <span className="text-[11px] text-[var(--color-alert)]">{errors.beatTitle.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)]">
            <span>Cover Palette</span>
            <input {...register("coverPalette")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.coverPalette ? <span className="text-[11px] text-[var(--color-alert)]">{errors.coverPalette.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)] md:col-span-2">
            <span>Spotify URL</span>
            <input {...register("spotifyUrl")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.spotifyUrl ? <span className="text-[11px] text-[var(--color-alert)]">{errors.spotifyUrl.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)] md:col-span-2">
            <span>Apple Music URL</span>
            <input {...register("appleMusicUrl")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.appleMusicUrl ? <span className="text-[11px] text-[var(--color-alert)]">{errors.appleMusicUrl.message}</span> : null}
          </label>
          <label className="space-y-1 text-xs uppercase tracking-[0.16em] text-[var(--color-paper-300)] md:col-span-2">
            <span>YouTube URL</span>
            <input {...register("youtubeUrl")} className="w-full border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm" />
            {errors.youtubeUrl ? <span className="text-[11px] text-[var(--color-alert)]">{errors.youtubeUrl.message}</span> : null}
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (locale === "ru" ? "Сохранение" : "Saving") : (locale === "ru" ? "Сохранить" : "Save")}
            </Button>
            {statusMessage ? <p className="text-xs text-[var(--color-paper-300)]">{statusMessage}</p> : null}
          </div>
        </form>
      ) : statusMessage ? (
        <p className="text-xs text-[var(--color-paper-300)]">{statusMessage}</p>
      ) : null}
    </section>
  );
}
