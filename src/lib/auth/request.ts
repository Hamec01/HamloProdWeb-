/**
 * Client IP + user agent for Route Handlers.
 *
 * The IP is taken ONLY from headers the platform controls:
 *   1. `x-vercel-forwarded-for` — set by Vercel, cannot be spoofed by the client.
 *   2. `x-real-ip` — set by Vercel / most reverse proxies.
 * A client-supplied `x-forwarded-for` is trusted ONLY outside production, or when
 * `TRUST_FORWARDED_FOR=true` is set for a known-trusted deployment (documented in
 * docs/admin-auth.md). The `Host` header is never used for any security decision.
 */

import { isIP } from "node:net";

const MAX_IP_LENGTH = 45; // IPv6 max

/** A value safe to store in a Postgres `inet` column, or null. */
export function inetOrNull(ip: string | null | undefined): string | null {
  return ip && isIP(ip) !== 0 ? ip : null;
}

function firstIp(value: string | null): string | null {
  if (!value) return null;
  const ip = value.split(",")[0]?.trim();
  return ip && ip.length > 0 && ip.length <= MAX_IP_LENGTH ? ip : null;
}

export function clientIp(request: Request, env: Record<string, string | undefined> = process.env): string {
  const trusted =
    firstIp(request.headers.get("x-vercel-forwarded-for")) || firstIp(request.headers.get("x-real-ip"));

  if (trusted) {
    return trusted;
  }

  const allowForwardedFor = env.NODE_ENV !== "production" || env.TRUST_FORWARDED_FOR === "true";
  if (allowForwardedFor) {
    const forwarded = firstIp(request.headers.get("x-forwarded-for"));
    if (forwarded) return forwarded;
  }

  return "unknown";
}

export function clientInfo(request: Request): { ip: string; userAgent: string | null } {
  return {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}
