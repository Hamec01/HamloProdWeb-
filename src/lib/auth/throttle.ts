/**
 * PostgreSQL-backed login throttle. Server-only.
 *
 * Not an in-memory limiter — Vercel runs many instances, so the counter lives in
 * the database. The key is an HMAC of (normalised email + IP); the plaintext
 * email / IP is never stored.
 */

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getSessionSecret } from "@/lib/auth/config";

export const MAX_FAILED_ATTEMPTS = 10;
export const WINDOW_MS = 15 * 60 * 1000;
export const BLOCK_MS = 15 * 60 * 1000;
const SWEEP_PROBABILITY = 0.05;

export function throttleKey(email: string, ip: string): string {
  const normalised = `${email.trim().toLowerCase()}|${ip.trim()}`;
  return createHmac("sha256", getSessionSecret()).update(`auth-throttle:${normalised}`).digest("hex");
}

export type ThrottleStatus =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number };

export async function checkThrottle(keyHash: string): Promise<ThrottleStatus> {
  const row = await prisma.authThrottle.findUnique({
    where: { keyHash },
    select: { blockedUntil: true },
  });

  if (row?.blockedUntil && row.blockedUntil.getTime() > Date.now()) {
    return { blocked: true, retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000) };
  }

  return { blocked: false };
}

/** Record a failed attempt. Returns the resulting status (blocked once the cap is hit). */
export async function recordFailedAttempt(keyHash: string): Promise<ThrottleStatus> {
  const now = new Date();
  const existing = await prisma.authThrottle.findUnique({ where: { keyHash } });

  const windowExpired = !existing || now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS;
  const attempts = windowExpired ? 1 : existing.attempts + 1;
  const windowStartedAt = windowExpired ? now : existing.windowStartedAt;
  const blockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null;

  await prisma.authThrottle.upsert({
    where: { keyHash },
    create: { keyHash, attempts, windowStartedAt, blockedUntil },
    update: { attempts, windowStartedAt, blockedUntil },
  });

  if (Math.random() < SWEEP_PROBABILITY) {
    await sweepExpired();
  }

  if (blockedUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
  }

  return { blocked: false };
}

/** Clear the throttle for a key after a successful login. */
export async function clearThrottle(keyHash: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { keyHash } });
}

/** Remove rows that are idle and not currently blocking. */
export async function sweepExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(WINDOW_MS, BLOCK_MS) * 2);
  const result = await prisma.authThrottle.deleteMany({
    where: {
      updatedAt: { lt: cutoff },
      OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date() } }],
    },
  });
  return result.count;
}
