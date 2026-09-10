/**
 * Own admin authentication — PostgreSQL-backed sessions. Server-only.
 *
 * No Supabase. The opaque session token is 32 random bytes; the database stores
 * only its HMAC-SHA256 (keyed by SESSION_SECRET). The raw token lives only in the
 * cookie and is never logged.
 *
 * Cookie writes happen ONLY in Route Handlers (`login`, `logout`, `refresh`).
 * `getAdminSessionState` / `requireAdminSession` are read-only and safe in Server
 * Components — they never rotate or set a cookie.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { getSessionSecret } from "@/lib/auth/config";
import { adminCookieName } from "@/lib/auth/cookies";
import { isAdminRole, type AdminRole } from "@/lib/auth/admin-roles";
import { inetOrNull } from "@/lib/auth/request";

export { ADMIN_ROLES, isAdminRole, type AdminRole } from "@/lib/auth/admin-roles";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type AdminSessionState = {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  role: AdminRole | null;
  sessionId: string | null;
  expiresAt: Date | null;
  /** true once less than half the TTL remains — the client should POST /api/admin/auth/refresh. */
  shouldRefresh: boolean;
};

const UNAUTHENTICATED: AdminSessionState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  role: null,
  sessionId: null,
  expiresAt: null,
  shouldRefresh: false,
};

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(token, "utf8").digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export type CreatedSession = { token: string; sessionId: string; expiresAt: Date };

export async function createAdminSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CreatedSession> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      scope: "admin",
      expiresAt,
      ip: inetOrNull(meta.ip),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    },
    select: { id: true },
  });

  return { token, sessionId: session.id, expiresAt };
}

/** Pure validation for a raw token. Returns the unauthenticated state on any failure. */
export async function validateAdminSession(token: string | undefined | null): Promise<AdminSessionState> {
  if (!token) {
    return UNAUTHENTICATED;
  }

  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      scope: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });

  if (!session || !hashesEqual(session.tokenHash, tokenHash) || session.scope !== "admin") {
    return UNAUTHENTICATED;
  }

  if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
    return UNAUTHENTICATED;
  }

  if (!isAdminRole(session.user.role)) {
    return UNAUTHENTICATED;
  }

  const remainingMs = session.expiresAt.getTime() - Date.now();

  return {
    isAuthenticated: true,
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sessionId: session.id,
    expiresAt: session.expiresAt,
    shouldRefresh: remainingMs < ADMIN_SESSION_TTL_MS / 2,
  };
}

/** Idempotent: revoking an already-revoked or unknown session is a no-op. */
export async function revokeAdminSession(input: { token?: string; sessionId?: string }): Promise<void> {
  const where = input.token
    ? { tokenHash: hashSessionToken(input.token) }
    : input.sessionId
      ? { id: input.sessionId }
      : null;

  if (!where) {
    return;
  }

  await prisma.session.updateMany({
    where: { ...where, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke the current session and issue a new one in a single transaction.
 *
 * The revoke is a conditional `updateMany` (tokenHash matches, not revoked, not
 * expired). Two concurrent refreshes race on that UPDATE: exactly one sees
 * `count === 1` and proceeds; the other sees `count === 0` and returns `null`.
 * The admin role is re-checked inside the transaction. Unexpected DB errors
 * propagate (they are NOT collapsed into "invalid session").
 */
export async function rotateAdminSession(
  token: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CreatedSession | null> {
  const oldHash = hashSessionToken(token);
  const newToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const revoked = await tx.session.updateMany({
      where: { tokenHash: oldHash, scope: "admin", revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });

    if (revoked.count !== 1) {
      return null;
    }

    const current = await tx.session.findUnique({
      where: { tokenHash: oldHash },
      select: { userId: true, user: { select: { role: true } } },
    });

    if (!current || !isAdminRole(current.user.role)) {
      return null;
    }

    const next = await tx.session.create({
      data: {
        userId: current.userId,
        tokenHash: hashSessionToken(newToken),
        scope: "admin",
        expiresAt,
        ip: inetOrNull(meta.ip),
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
      },
      select: { id: true },
    });

    return { token: newToken, sessionId: next.id, expiresAt };
  });
}

/** Revoke every non-revoked session for a user (e.g. after a password change). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Read-only. Reads the cookie and validates it. Never writes a cookie / rotates. */
export async function getAdminSessionState(): Promise<AdminSessionState> {
  const store = await cookies();
  const token = store.get(adminCookieName())?.value;
  return validateAdminSession(token);
}

export async function requireAdminSession(): Promise<AdminSessionState> {
  const state = await getAdminSessionState();

  if (!state.isAuthenticated) {
    redirect("/admin/login");
  }

  return state;
}
