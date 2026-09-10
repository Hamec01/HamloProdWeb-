/**
 * Argon2id password hashing for admin accounts. Server-only.
 *
 * `argon2` is a native module — it must never be bundled for the browser or the
 * Edge runtime. Import this module only from Node.js Route Handlers / server
 * scripts (never from a Client Component, middleware, or an Edge route).
 */

import argon2 from "argon2";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/** Buyer (public) accounts use a lighter minimum than the admin policy. */
export const MIN_BUYER_PASSWORD_LENGTH = 8;

/** bcrypt only hashes the first 72 bytes; comparisons must use the same cap. */
const BCRYPT_MAX_BYTES = 72;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // KiB (~19 MiB) — OWASP baseline
  timeCost: 2,
  parallelism: 1,
} as const;

export class WeakPasswordError extends Error {
  readonly code = "WEAK_PASSWORD";

  constructor(message: string) {
    super(message);
    this.name = "WeakPasswordError";
  }
}

/** Enforce the admin password policy. Throws {@link WeakPasswordError}. */
export function assertPasswordPolicy(password: string, minLength = MIN_PASSWORD_LENGTH): void {
  if (typeof password !== "string" || password.length < minLength) {
    throw new WeakPasswordError(`Password must be at least ${minLength} characters.`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
}

/** Enforce the buyer (public) password policy. Throws {@link WeakPasswordError}. */
export function assertBuyerPasswordPolicy(password: string): void {
  assertPasswordPolicy(password, MIN_BUYER_PASSWORD_LENGTH);
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash. Returns `false` (never throws) for a
 * malformed / empty hash or an out-of-range password, so callers can treat every
 * failure identically.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (typeof hash !== "string" || !hash.startsWith("$argon2")) {
    return false;
  }

  if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * A real, fixed Argon2id hash (of a random throwaway value). The login handler
 * verifies against this when the email is unknown so it spends the same time as
 * a real check and never reveals whether an account exists.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$HNMWtfu/uEdj5XRypOxlAg$vob3iMXt3EfmQyC6JotdaOzAVzcBvIPvLT+WdaMg0bY";

/** True for a legacy Supabase bcrypt hash ($2a$ / $2b$ / $2y$). */
export function isLegacyBcryptHash(hash: string | null | undefined): boolean {
  return typeof hash === "string" && /^\$2[aby]?\$\d{2}\$/.test(hash);
}

/** True once a stored hash is our current Argon2id format. */
export function isCurrentHash(hash: string | null | undefined): boolean {
  return typeof hash === "string" && hash.startsWith("$argon2id$");
}

/**
 * Verify a password against a stored hash of EITHER format — current Argon2id or
 * a legacy Supabase bcrypt hash. Returns `false` (never throws) on any problem so
 * every failure looks identical to the caller. When this returns `true` for a
 * bcrypt hash, the caller should re-hash with {@link hashPassword} and persist it.
 */
export async function verifyPasswordAnyFormat(hash: string, password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  if (isLegacyBcryptHash(hash)) {
    try {
      // Match bcrypt's own 72-byte input cap so a long password still verifies.
      const capped = Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES
        ? Buffer.from(password, "utf8").subarray(0, BCRYPT_MAX_BYTES).toString("utf8")
        : password;
      return await bcrypt.compare(capped, hash);
    } catch {
      return false;
    }
  }

  return verifyPassword(hash, password);
}
