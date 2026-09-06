/**
 * Transport-agnostic admin login / logout logic. No `next/*`, no direct Prisma —
 * the Route Handlers inject real ports; unit tests inject fakes.
 *
 * The login response is deliberately identical (HTTP 401, same body) whether the
 * email is unknown, the password is wrong, or the account lacks an admin role.
 * A dummy Argon2 verification runs even when the email is unknown so timing does
 * not leak account existence.
 *
 * Throttling has two independent scopes (email, IP). Logout propagates a failed
 * revoke — the caller must NOT clear the cookie or report success in that case.
 */

import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { isAdminRole } from "@/lib/auth/admin-roles";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { ThrottleStatus } from "@/lib/auth/throttle";

export type AdminUserRecord = {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string | null;
};

export type ThrottleKeys = { emailKey: string; ipKey: string };

export type LoginPorts = {
  findUserByEmail(email: string): Promise<AdminUserRecord | null>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
  createSession(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<{ token: string; expiresAt: Date }>;
  throttleKeys(email: string, ip: string): ThrottleKeys;
  checkThrottle(keys: ThrottleKeys): Promise<ThrottleStatus>;
  recordFailedAttempt(keys: ThrottleKeys): Promise<ThrottleStatus>;
  clearEmailThrottle(emailKey: string): Promise<void>;
  dummyHash: string;
};

export type LogoutPorts = {
  revokeSession(token: string): Promise<void>;
};

export type ServiceResult = {
  status: number;
  body: Record<string, unknown>;
  setSession?: { token: string; expiresAt: Date };
  clearSession?: boolean;
};

const loginSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

const INVALID_CREDENTIALS: ServiceResult = { status: 401, body: { error: "Invalid email or password." } };

function forbidden(): ServiceResult {
  return { status: 403, body: { error: "Forbidden" } };
}

function tooMany(retryAfterSeconds: number): ServiceResult {
  return { status: 429, body: { error: "Too many attempts. Try again later.", retryAfterSeconds } };
}

export async function loginAdmin(input: {
  ports: LoginPorts;
  body: unknown;
  ip: string | null;
  userAgent: string | null;
  sameOrigin: boolean;
}): Promise<ServiceResult> {
  if (!input.sameOrigin) {
    return forbidden();
  }

  const parsed = loginSchema.safeParse(input.body);

  if (!parsed.success) {
    return INVALID_CREDENTIALS;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = input.ip ?? "unknown";
  const keys = input.ports.throttleKeys(email, ip);

  const pre = await input.ports.checkThrottle(keys);
  if (pre.blocked) {
    return tooMany(pre.retryAfterSeconds);
  }

  const user = await input.ports.findUserByEmail(email);
  const hashToCheck = user?.passwordHash ?? input.ports.dummyHash;
  const passwordOk = await input.ports.verifyPassword(hashToCheck, parsed.data.password);

  const authorized = passwordOk && user !== null && user.passwordHash !== null && isAdminRole(user.role);

  if (!authorized) {
    const post = await input.ports.recordFailedAttempt(keys);
    return post.blocked ? tooMany(post.retryAfterSeconds) : INVALID_CREDENTIALS;
  }

  await input.ports.clearEmailThrottle(keys.emailKey);
  const session = await input.ports.createSession(user!.id, { ip: input.ip, userAgent: input.userAgent });

  return { status: 200, body: { ok: true }, setSession: session };
}

/**
 * Revokes the current session. Throws if the revoke itself fails — the Route
 * Handler must then return 503 and keep the cookie so the user can retry.
 */
export async function logoutAdmin(input: {
  ports: LogoutPorts;
  token: string | undefined;
  sameOrigin: boolean;
}): Promise<ServiceResult> {
  if (!input.sameOrigin) {
    return forbidden();
  }

  if (input.token) {
    await input.ports.revokeSession(input.token);
  }

  return { status: 200, body: { ok: true }, clearSession: true };
}
