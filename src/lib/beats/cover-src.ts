import type { Beat } from "@/types";

// Stable versioned source for Next Image's internal fetch. The image optimizer
// caches thumbnails and avoids its seven-second external-origin fetch timeout.
export function beatCoverSrc(beat: Beat): string {
  return `/api/beats/${beat.id}/cover?v=${encodeURIComponent(beat.coverImageUrl?.split("/").at(-1) ?? "")}`;
}
