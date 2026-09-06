import type { Page, PageRequest } from "./common";

export interface FavoriteRepository {
  listTrackIds(userId: string, page: PageRequest): Promise<Page<string>>;
  /** Idempotent; database uniqueness on (userId, trackId). */
  set(userId: string, trackId: string, favorite: boolean): Promise<void>;
}
