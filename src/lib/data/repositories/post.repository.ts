import type { Post } from "@/types/post";
import type { CreateRecord, UpdateRecord, Page, PageRequest } from "./common";

/** Internal persistence model; services redact private paths before public responses. */
export interface PostRepository {
  list(query: PageRequest & { section?: Post["section"]; published?: boolean; featured?: boolean; }): Promise<Page<Post>>;
  findById(id: string): Promise<Post | null>;
  findBySlug(slug: string): Promise<Post | null>;
  create(input: CreateRecord<Post>): Promise<Post>;
  update(id: string, input: UpdateRecord<Post>): Promise<Post | null>;
  delete(id: string): Promise<boolean>;
}
