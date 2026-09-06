export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
};

/** Persist only a hash of the random cookie token. All times are UTC ISO strings. */
export interface SessionRepository {
  create(input: Omit<SessionRecord, "id" | "createdAt" | "revokedAt">): Promise<SessionRecord>;
  findActiveByTokenHash(tokenHash: string, now: string): Promise<SessionRecord | null>;
  /** Atomically revoke the active old session and create its replacement; null on replay. */
  rotate(tokenHash: string, replacement: { tokenHash: string; expiresAt: string }, now: string): Promise<SessionRecord | null>;
  revoke(tokenHash: string, now: string): Promise<void>;
  revokeAllForUser(userId: string, now: string): Promise<void>;
  deleteExpired(now: string): Promise<number>;
}
