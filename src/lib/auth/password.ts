/**
 * Argon2id password hashing for admin accounts. Server-only.
 *
 * `argon2` is a native module — it must never be bundled for the browser or the
 * Edge runtime. Import this module only from Node.js Route Handlers / server
 * scripts (never from a Client Component, middleware, or an Edge route).
 */

import argon2 from "argon2";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

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
export function assertPasswordPolicy(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
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
