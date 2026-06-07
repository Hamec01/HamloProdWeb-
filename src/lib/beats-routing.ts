import type { Beat } from "@/types";

export function getBeatRouteSegment(beat: Pick<Beat, "id"> & { slug: Beat["slug"] | null | undefined }) {
  return encodeURIComponent((beat.slug ?? "").trim() || beat.id);
}
