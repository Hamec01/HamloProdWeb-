import type { UserRole } from "@/types/user-role";

export type UserRecord = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  role: UserRole | null;
  artistId: string | null;
  createdAt: string;
};
/** Password hashes stay in the authentication service, never in public user DTOs. */
export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(normalizedEmail: string): Promise<UserRecord | null>;
  getPasswordHash(userId: string): Promise<string | null>;
  create(input: { email: string; passwordHash: string }): Promise<UserRecord>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setEmailVerified(userId: string, verifiedAt: string): Promise<void>;
  setRole(userId: string, role: UserRole | null, artistId: string | null): Promise<void>;
}
