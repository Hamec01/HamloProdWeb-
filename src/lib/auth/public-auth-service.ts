/**
 * Transport-agnostic buyer (public) auth: signup / login / logout. No `next/*`,
 * no direct Prisma — Route Handlers inject real ports, tests inject fakes.
 *
 * Security properties (mirror the admin service):
 *   - identical 401 response for unknown email, wrong password, or an account
 *     that has no password set (a real dummy-hash verification runs when the
 *     email is unknown so timing does not leak existence);
 *   - two-scope throttle (email, IP), blocked when EITHER is over the limit;
 *   - origin allow-list enforced before any DB work;
 *   - signup for an email that already exists is handled as a login attempt with
 *     the supplied password — so signup cannot be used to enumerate accounts;
 *   - a legacy bcrypt hash that verifies is transparently upgraded to Argon2id;
 *   - credentials and session tokens are never returned in a body or logged.
 */

import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_BUYER_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { ThrottleStatus } from "@/lib/auth/throttle";

export type PublicUserRecord = {
  id: string;
  email: string;
  passwordHash: string | null;
};

export type ThrottleKeys = { emailKey: string; ipKey: string };

export type PublicAuthPorts = {
  findUserByEmail(email: string): Promise<PublicUserRecord | null>;
  createUser(input: { email: string; passwordHash: string }): Promise<PublicUserRecord>;
  /** Verify against a hash of either format (Argon2id or legacy bcrypt). */
  verifyPassword(hash: string, password: string): Promise<boolean>;
  isLegacyHash(hash: string): boolean;
  hashPassword(password: string): Promise<string>;
  upgradePasswordHash(userId: string, passwordHash: string): Promise<void>;
  recordSignIn(userId: string): Promise<void>;
  createSession(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<{ token: string; expiresAt: Date }>;
  throttleKeys(email: string, ip: string): ThrottleKeys;
  checkThrottle(keys: ThrottleKeys): Promise<ThrottleStatus>;
  recordFailedAttempt(keys: ThrottleKeys): Promise<ThrottleStatus>;
  clearEmailThrottle(emailKey: string): Promise<void>;
  dummyHash: string;
};

export type ServiceResult = {
  status: number;
  body: Record<string, unknown>;
  setSession?: { token: string; expiresAt: Date };
  clearSession?: boolean;
};

const credentialsSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

const INVALID_CREDENTIALS: ServiceResult = { status: 401, body: { error: "Invalid email or password." } };
const forbidden = (): ServiceResult => ({ status: 403, body: { error: "Forbidden" } });
const tooMany = (retryAfterSeconds: number): ServiceResult => ({
  status: 429,
  body: { error: "Too many attempts. Try again later.", retryAfterSeconds },
});

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Shared credential check + session mint. Assumes origin + throttle already ok. */
async function authenticate(
  ports: PublicAuthPorts,
  keys: ThrottleKeys,
  email: string,
  password: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ServiceResult> {
  const user = await ports.findUserByEmail(email);
  const hashToCheck = user?.passwordHash ?? ports.dummyHash;
  const passwordOk = await ports.verifyPassword(hashToCheck, password);
  const authorized = passwordOk && user !== null && user.passwordHash !== null;

  if (!authorized) {
    const post = await ports.recordFailedAttempt(keys);
    return post.blocked ? tooMany(post.retryAfterSeconds) : INVALID_CREDENTIALS;
  }

  await ports.clearEmailThrottle(keys.emailKey);

  if (ports.isLegacyHash(user!.passwordHash!)) {
    try {
      await ports.upgradePasswordHash(user!.id, await ports.hashPassword(password));
    } catch {
      // Upgrade is best-effort — a failure must not block the login.
    }
  }

  await ports.recordSignIn(user!.id).catch(() => {});
  const session = await ports.createSession(user!.id, meta);
  return { status: 200, body: { ok: true }, setSession: session };
}

export async function loginBuyer(input: {
  ports: PublicAuthPorts;
  body: unknown;
  ip: string | null;
  userAgent: string | null;
  sameOrigin: boolean;
}): Promise<ServiceResult> {
  if (!input.sameOrigin) return forbidden();

  const parsed = credentialsSchema.safeParse(input.body);
  if (!parsed.success) return INVALID_CREDENTIALS;

  const email = normalizeEmail(parsed.data.email);
  const ip = input.ip ?? "unknown";
  const keys = input.ports.throttleKeys(email, ip);

  const pre = await input.ports.checkThrottle(keys);
  if (pre.blocked) return tooMany(pre.retryAfterSeconds);

  return authenticate(input.ports, keys, email, parsed.data.password, { ip: input.ip, userAgent: input.userAgent });
}

export async function signupBuyer(input: {
  ports: PublicAuthPorts;
  body: unknown;
  ip: string | null;
  userAgent: string | null;
  sameOrigin: boolean;
}): Promise<ServiceResult> {
  if (!input.sameOrigin) return forbidden();

  const parsed = credentialsSchema.safeParse(input.body);
  if (!parsed.success) {
    return { status: 400, body: { error: `Email and a password of at least ${MIN_BUYER_PASSWORD_LENGTH} characters are required.` } };
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const ip = input.ip ?? "unknown";
  const keys = input.ports.throttleKeys(email, ip);

  const pre = await input.ports.checkThrottle(keys);
  if (pre.blocked) return tooMany(pre.retryAfterSeconds);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < MIN_BUYER_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { status: 400, body: { error: `Enter a valid email and a password of ${MIN_BUYER_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.` } };
  }

  // If the email is already registered, treat this as a login attempt with the
  // supplied password — signup cannot be used to probe for existing accounts.
  const existing = await input.ports.findUserByEmail(email);
  if (existing) {
    return authenticate(input.ports, keys, email, password, { ip: input.ip, userAgent: input.userAgent });
  }

  const passwordHash = await input.ports.hashPassword(password);
  const user = await input.ports.createUser({ email, passwordHash });

  await input.ports.clearEmailThrottle(keys.emailKey);
  await input.ports.recordSignIn(user.id).catch(() => {});
  const session = await input.ports.createSession(user.id, { ip: input.ip, userAgent: input.userAgent });
  return { status: 201, body: { ok: true, created: true }, setSession: session };
}

export async function logoutBuyer(input: {
  ports: { revokeSession(token: string): Promise<void> };
  token: string | undefined;
  sameOrigin: boolean;
}): Promise<ServiceResult> {
  if (!input.sameOrigin) return forbidden();
  if (input.token) {
    await input.ports.revokeSession(input.token);
  }
  return { status: 200, body: { ok: true }, clearSession: true };
}
