/**
 * PostgreSQL-backed login throttle. Server-only.
 *
 * Two independent scopes, each its own HMAC key (plaintext email / IP is never
 * stored):
 *   - email scope: 10 failed attempts / 15 min
 *   - IP scope:    30 failed attempts / 15 min
 * A request is blocked when EITHER scope is over its limit.
 *
 * Counting is done with a single `INSERT ... ON CONFLICT DO UPDATE` statement, so
 * concurrent failures cannot lose increments (Postgres locks the conflicting row
 * for the upsert).
 */

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getSessionSecret } from "@/lib/auth/config";

export const EMAIL_MAX_ATTEMPTS = 10;
export const IP_MAX_ATTEMPTS = 30;
export const WINDOW_MINUTES = 15;
export const BLOCK_MINUTES = 15;
const SWEEP_PROBABILITY = 0.05;

export type ThrottleScope = "email" | "ip";

function scopeKey(scope: ThrottleScope, value: string): string {
  const normalised = scope === "email" ? value.trim().toLowerCase() : value.trim();
  return createHmac("sha256", getSessionSecret()).update(`auth-throttle:${scope}:${normalised}`).digest("hex");
}

export function emailThrottleKey(email: string): string {
  return scopeKey("email", email);
}

export function ipThrottleKey(ip: string): string {
  return scopeKey("ip", ip || "unknown");
}

export type ThrottleStatus =
  | { blocked: false }
  | { blocked: true; retryAfterSeconds: number };

type UpsertRow = { attempts: number; blocked_until: Date | null };

function blockedFor(blockedUntil: Date | null): number {
  return blockedUntil ? Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)) : 0;
}

/** Check both scopes without recording anything. */
export async function checkThrottle(keys: { emailKey: string; ipKey: string }): Promise<ThrottleStatus> {
  const rows = await prisma.authThrottle.findMany({
    where: { keyHash: { in: [keys.emailKey, keys.ipKey] }, blockedUntil: { gt: new Date() } },
    select: { blockedUntil: true },
  });

  const retry = Math.max(0, ...rows.map((row) => blockedFor(row.blockedUntil)));
  return retry > 0 ? { blocked: true, retryAfterSeconds: retry } : { blocked: false };
}

async function bump(keyHash: string, maxAttempts: number): Promise<UpsertRow> {
  const windowInterval = `${WINDOW_MINUTES} minutes`;
  const blockInterval = `${BLOCK_MINUTES} minutes`;

  const rows = await prisma.$queryRaw<UpsertRow[]>`
    INSERT INTO auth_throttle (id, key_hash, attempts, window_started_at, blocked_until, updated_at)
    VALUES (gen_random_uuid(), ${keyHash}, 1, now(), NULL, now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE
        WHEN auth_throttle.window_started_at < now() - ${windowInterval}::interval THEN 1
        ELSE auth_throttle.attempts + 1
      END,
      window_started_at = CASE
        WHEN auth_throttle.window_started_at < now() - ${windowInterval}::interval THEN now()
        ELSE auth_throttle.window_started_at
      END,
      blocked_until = CASE
        WHEN (CASE
                WHEN auth_throttle.window_started_at < now() - ${windowInterval}::interval THEN 1
                ELSE auth_throttle.attempts + 1
              END) >= ${maxAttempts}
          THEN now() + ${blockInterval}::interval
        ELSE NULL
      END,
      updated_at = now()
    RETURNING attempts, blocked_until
  `;

  return rows[0] ?? { attempts: 1, blocked_until: null };
}

/** Record one failed attempt in both scopes atomically. Returns the combined status. */
export async function recordFailedAttempt(keys: { emailKey: string; ipKey: string }): Promise<ThrottleStatus> {
  const [emailRow, ipRow] = await Promise.all([
    bump(keys.emailKey, EMAIL_MAX_ATTEMPTS),
    bump(keys.ipKey, IP_MAX_ATTEMPTS),
  ]);

  if (Math.random() < SWEEP_PROBABILITY) {
    await sweepExpired();
  }

  const retry = Math.max(blockedFor(emailRow.blocked_until), blockedFor(ipRow.blocked_until));
  return retry > 0 ? { blocked: true, retryAfterSeconds: retry } : { blocked: false };
}

/**
 * A successful login clears the EMAIL scope only. The IP scope is left intact
 * (one good login from a shared / NAT'd address must not wipe the IP counter).
 */
export async function clearEmailThrottle(emailKey: string): Promise<void> {
  await prisma.authThrottle.deleteMany({ where: { keyHash: emailKey } });
}

/** Remove rows that are idle and not currently blocking. */
export async function sweepExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - (WINDOW_MINUTES + BLOCK_MINUTES) * 60 * 1000 * 2);
  const result = await prisma.authThrottle.deleteMany({
    where: {
      updatedAt: { lt: cutoff },
      OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date() } }],
    },
  });
  return result.count;
}
