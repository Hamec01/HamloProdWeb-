/**
 * Buyer (public) sessions — PostgreSQL-backed, own auth. Server-only, no Supabase.
 *
 * Same token model as the admin session (`src/lib/auth/session.ts`): the opaque
 * token is 32 random bytes, the database stores only its HMAC-SHA256, the raw
 * token lives only in the `hp_session` cookie and is never logged. Sessions are
 * `scope = "public"`; a public token is refused by the admin validator and vice
 * versa.
 */

import { prisma } from "@/lib/db/client";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/session";
import { PUBLIC_SESSION_TTL_MS } from "@/lib/auth/public-cookies";
import { inetOrNull } from "@/lib/auth/request";

export type PublicSessionUser = {
  sessionId: string;
  userId: string;
  email: string;
  role: string;
  artistId: string | null;
  expiresAt: Date;
};

export type CreatedPublicSession = { token: string; expiresAt: Date };

export async function createPublicSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CreatedPublicSession> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + PUBLIC_SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      scope: "public",
      expiresAt,
      ip: inetOrNull(meta.ip),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    },
    select: { id: true },
  });

  return { token, expiresAt };
}

/** Validate a raw public session token. Returns null on any failure. */
export async function validatePublicSessionToken(token: string | undefined | null): Promise<PublicSessionUser | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      scope: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, email: true, role: true, artistId: true } },
    },
  });

  if (!session || session.scope !== "public") return null;
  if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) return null;

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    artistId: session.user.artistId,
    expiresAt: session.expiresAt,
  };
}

/** Idempotent — revoking an unknown / already-revoked token is a no-op. */
export async function revokePublicSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), scope: "public", revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
