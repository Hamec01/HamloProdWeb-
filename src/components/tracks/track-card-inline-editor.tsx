"use client";

import { useState } from "react";
import { Edit2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Track } from "@/types";

type EditableTrack = Partial<Track>;

export function TrackCardInlineEditor({
  track,
  onUpdate,
  isAuthenticated,
}: {
  track: Track;
  onUpdate?: (updated: Track) => void;
  isAuthenticated: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editValues, setEditValues] = useState<EditableTrack>({ ...track });
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tracks/${track.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "Save failed");
      }

      onUpdate?.({ ...track, ...editValues } as Track);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving track");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValues({ ...track });
    setIsEditing(false);
    setError(null);
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="case-panel w-full max-w-md space-y-4 p-6">
          <h2 className="text-lg font-bold uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
            Edit Track
          </h2>

          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Title</span>
              <input
                type="text"
                value={editValues.title ?? ""}
                onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Release Date</span>
              <input
                type="date"
                value={editValues.releaseDate ?? ""}
                onChange={(e) => setEditValues({ ...editValues, releaseDate: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Artist</span>
              <input
                type="text"
                value={editValues.artistName ?? ""}
                onChange={(e) => setEditValues({ ...editValues, artistName: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editValues.isDemo ?? false}
                onChange={(e) => setEditValues({ ...editValues, isDemo: e.target.checked })}
                className="h-4 w-4 accent-amber-500"
              />
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Demo Track</span>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Spotify URL</span>
              <input
                type="url"
                value={editValues.spotifyUrl ?? ""}
                onChange={(e) => setEditValues({ ...editValues, spotifyUrl: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">Apple Music URL</span>
              <input
                type="url"
                value={editValues.appleMusicUrl ?? ""}
                onChange={(e) => setEditValues({ ...editValues, appleMusicUrl: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="uppercase tracking-[0.12em] text-[var(--color-paper-200)]">YouTube URL</span>
              <input
                type="url"
                value={editValues.youtubeUrl ?? ""}
                onChange={(e) => setEditValues({ ...editValues, youtubeUrl: e.target.value })}
                className="w-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-paper-100)]"
              />
            </label>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCancel} disabled={isLoading}>
              <X size={14} />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "..." : <Check size={14} />}
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center border border-[var(--color-line)] text-[var(--color-paper-400)] transition-colors hover:border-amber-500 hover:text-amber-500"
      title="Edit track"
    >
      <Edit2 size={12} />
    </button>
  );
}
