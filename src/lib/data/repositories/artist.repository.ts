import type { Artist } from "@/types/artist";
import type { CreateRecord, UpdateRecord, Page, PageRequest } from "./common";

/** Internal persistence model; services redact private paths before public responses. */
export interface ArtistRepository {
  list(query: PageRequest & {  }): Promise<Page<Artist>>;
  findById(id: string): Promise<Artist | null>;
  findBySlug(slug: string): Promise<Artist | null>;
  create(input: CreateRecord<Artist>): Promise<Artist>;
  update(id: string, input: UpdateRecord<Artist>): Promise<Artist | null>;
  delete(id: string): Promise<boolean>;
}
