import { cookies } from "next/headers";
import { isAuthConfigured } from "@/lib/auth/config";
import { adminCookieName, adminCookieOptions, ALL_ADMIN_COOKIE_NAMES, clearedAdminCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { clientInfo } from "@/lib/auth/request";
import { jsonNoStore } from "@/lib/auth/response";
import { rotateAdminSession, validateAdminSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Rotates the admin session. The client should call this ONLY when the current
 * session has less than half its TTL left (see `shouldRefresh` from
 * `/api/admin/auth/me`); the server no-ops otherwise.
 */
export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return jsonNoStore({ error: "Forbidden" }, { status: 403 });
  }

  const store = await cookies();
  const token = store.get(adminCookieName())?.value;

  const clearAndReject = () => {
    const response = jsonNoStore({ error: "Session is not valid." }, { status: 401 });
    for (const name of ALL_ADMIN_COOKIE_NAMES) {
      response.cookies.set(name, "", clearedAdminCookieOptions());
    }
    return response;
  };

  if (!token) {
    return jsonNoStore({ error: "Session is not valid." }, { status: 401 });
  }

  let state;
  try {
    state = await validateAdminSession(token);
  } catch (error) {
    console.error("[admin/auth/refresh] validate error", error instanceof Error ? error.message : "unknown");
    return jsonNoStore({ error: "Could not refresh the session." }, { status: 500 });
  }

  if (!state.isAuthenticated) {
    return clearAndReject();
  }

  if (!state.shouldRefresh) {
    return jsonNoStore({ ok: true, refreshed: false, expiresAt: state.expiresAt });
  }

  const { ip, userAgent } = clientInfo(request);

  let rotated;
  try {
    rotated = await rotateAdminSession(token, { ip, userAgent });
  } catch (error) {
    // Unexpected DB error — NOT the same as "session invalid".
    console.error("[admin/auth/refresh] rotate error", error instanceof Error ? error.message : "unknown");
    return jsonNoStore({ error: "Could not refresh the session." }, { status: 500 });
  }

  if (!rotated) {
    // Lost the rotation race, or session became invalid — reject this token.
    return clearAndReject();
  }

  const response = jsonNoStore({ ok: true, refreshed: true, expiresAt: rotated.expiresAt });
  response.cookies.set(adminCookieName(), rotated.token, adminCookieOptions(rotated.expiresAt));
  return response;
}
