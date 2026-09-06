/**
 * Admin session cookie name + attributes. No Prisma, no secrets — safe to import
 * from any server context.
 *
 * Production uses the `__Host-` prefix, which the browser only accepts when the
 * cookie is Secure, Path=/ and has no Domain — exactly this configuration.
 */

const PROD_COOKIE_NAME = "__Host-hp_admin_session";
const DEV_COOKIE_NAME = "hp_admin_session";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function adminCookieName(production: boolean = isProduction()): string {
  return production ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
}

/** Every name the cookie could have — used when clearing on logout. */
export const ALL_ADMIN_COOKIE_NAMES = [PROD_COOKIE_NAME, DEV_COOKIE_NAME] as const;

export type AdminCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  expires: Date;
};

export function adminCookieOptions(expiresAt: Date, production: boolean = isProduction()): AdminCookieOptions {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge,
    expires: expiresAt,
  };
}

export function clearedAdminCookieOptions(production: boolean = isProduction()): AdminCookieOptions {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
