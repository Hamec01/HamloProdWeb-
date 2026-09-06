import type { Beat } from "@/types/beat";
import type { CreateRecord, UpdateRecord, Page, PageRequest } from "./common";

/** Internal persistence model; services redact private paths before public responses. */
export interface BeatRepository {
  list(query: PageRequest & { status?: Beat["status"]; featured?: boolean; }): Promise<Page<Beat>>;
  findById(id: string): Promise<Beat | null>;
  findBySlug(slug: string): Promise<Beat | null>;
  create(input: CreateRecord<Beat>): Promise<Beat>;
  update(id: string, input: UpdateRecord<Beat>): Promise<Beat | null>;
  delete(id: string): Promise<boolean>;
}
