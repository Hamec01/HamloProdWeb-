import type { Track } from "@/types/track";
import type { CreateRecord, UpdateRecord, Page, PageRequest } from "./common";

/** Internal persistence model; services redact private paths before public responses. */
export interface TrackRepository {
  list(query: PageRequest & { releaseId?: string; isDemo?: boolean; }): Promise<Page<Track>>;
  findById(id: string): Promise<Track | null>;
  findBySlug(slug: string): Promise<Track | null>;
  create(input: CreateRecord<Track>): Promise<Track>;
  update(id: string, input: UpdateRecord<Track>): Promise<Track | null>;
  delete(id: string): Promise<boolean>;
}
