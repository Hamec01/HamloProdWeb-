/**
 * Origin allow-list for state-changing (mutation) requests. Complements the
 * SameSite=Lax cookie — it does not replace it.
 *
 * The allow-list is fixed. Extra preview origins are read ONLY from a trusted
 * server env (`AUTH_EXTRA_ORIGINS`, comma-separated), never from the request's
 * own Host / X-Forwarded-Host header.
 */

export type EnvSource = Record<string, string | undefined>;

const BASE_ALLOWED_ORIGINS = [
  "https://hamloprod.org",
  "https://www.hamloprod.org",
  "http://localhost:3000",
] as const;

function extraOrigins(env: EnvSource): string[] {
  return (env.AUTH_EXTRA_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && /^https?:\/\//.test(value));
}

export function allowedOrigins(env: EnvSource = process.env): string[] {
  return [...BASE_ALLOWED_ORIGINS, ...extraOrigins(env)];
}

export function isAllowedOrigin(origin: string | null | undefined, env: EnvSource = process.env): boolean {
  if (!origin) {
    return false;
  }

  return allowedOrigins(env).includes(origin);
}

/**
 * Verify a mutation request's origin. Requires a valid `Origin` header; falls
 * back to the origin of `Referer` when `Origin` is absent (older browsers).
 * Returns `true` only when the resolved origin is on the allow-list.
 */
export function isSameOriginRequest(request: Request, env: EnvSource = process.env): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    return isAllowedOrigin(origin, env);
  }

  const referer = request.headers.get("referer");

  if (referer) {
    try {
      return isAllowedOrigin(new URL(referer).origin, env);
    } catch {
      return false;
    }
  }

  return false;
}
