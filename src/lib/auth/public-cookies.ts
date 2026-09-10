/**
 * Buyer (public) session cookie — separate name and lifetime from the admin
 * cookie (`src/lib/auth/cookies.ts`). No Prisma, no secrets.
 *
 * Production uses the `__Host-` prefix (browser only accepts it when Secure,
 * Path=/, no Domain — exactly this configuration).
 */

import { isProduction } from "@/lib/auth/cookies";

const PROD_COOKIE_NAME = "__Host-hp_session";
const DEV_COOKIE_NAME = "hp_session";

/** Buyer sessions last longer than admin sessions — 30 days, refreshed lazily. */
export const PUBLIC_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function publicCookieName(production: boolean = isProduction()): string {
  return production ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
}

export const ALL_PUBLIC_COOKIE_NAMES = [PROD_COOKIE_NAME, DEV_COOKIE_NAME] as const;

export type PublicCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  expires: Date;
};

export function publicCookieOptions(expiresAt: Date, production: boolean = isProduction()): PublicCookieOptions {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    expires: expiresAt,
  };
}

export function clearedPublicCookieOptions(production: boolean = isProduction()): PublicCookieOptions {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
