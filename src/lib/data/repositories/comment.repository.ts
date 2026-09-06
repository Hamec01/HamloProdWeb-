import type { Comment } from "@/types/artist";
import type { CreateRecord, Page, PageRequest } from "./common";

/** Legacy content_comments/content_ratings remain separate until M4 reconciliation. */
export interface CommentRepository {
  list(entity: Comment["entity"], contentId: string, page: PageRequest): Promise<Page<Comment>>;
  create(input: CreateRecord<Comment>): Promise<Comment>;
  deleteOwned(id: string, authorId: string): Promise<boolean>;
  deleteAsModerator(id: string): Promise<boolean>;
}
