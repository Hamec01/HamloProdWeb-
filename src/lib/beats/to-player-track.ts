import type { PlayerTrack } from "@/store/player-store";
import type { Beat } from "@/types/beat";

/** Public Beat DTO → player queue item. Nullable metadata becomes `undefined`. */
export function beatToPlayerTrack(beat: Beat): PlayerTrack {
  return {
    id: beat.id,
    title: beat.title,
    slug: beat.slug,
    previewUrl: beat.previewUrl ?? "",
    kind: "beat",
    bpm: beat.bpm ?? undefined,
    mood: beat.mood ?? undefined,
    duration: beat.duration ?? undefined,
    caseNumber: beat.caseNumber,
    status: beat.status,
  };
}
