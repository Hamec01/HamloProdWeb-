import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthConfigured } from "@/lib/auth/config";
import { adminCookieName, adminCookieOptions, ALL_ADMIN_COOKIE_NAMES, clearedAdminCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { clientInfo } from "@/lib/auth/request";
import { rotateAdminSession, validateAdminSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Rotates the admin session. The client should call this ONLY when the current
 * session has less than half its TTL left (see `shouldRefresh` from
 * `/api/admin/auth/me`); the server no-ops otherwise.
 */
export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const store = await cookies();
  const token = store.get(adminCookieName())?.value;

  const clearAndReject = () => {
    const response = NextResponse.json({ error: "Session is not valid." }, { status: 401 });
    for (const name of ALL_ADMIN_COOKIE_NAMES) {
      response.cookies.set(name, "", clearedAdminCookieOptions());
    }
    return response;
  };

  if (!token) {
    return NextResponse.json({ error: "Session is not valid." }, { status: 401 });
  }

  let state;
  try {
    state = await validateAdminSession(token);
  } catch (error) {
    console.error("[admin/auth/refresh] error", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not refresh the session." }, { status: 500 });
  }

  if (!state.isAuthenticated) {
    return clearAndReject();
  }

  if (!state.shouldRefresh) {
    return NextResponse.json({ ok: true, refreshed: false, expiresAt: state.expiresAt });
  }

  const { ip, userAgent } = clientInfo(request);
  const rotated = await rotateAdminSession(token, { ip, userAgent });

  if (!rotated) {
    return clearAndReject();
  }

  const response = NextResponse.json({ ok: true, refreshed: true, expiresAt: rotated.expiresAt });
  response.cookies.set(adminCookieName(), rotated.token, adminCookieOptions(rotated.expiresAt));
  return response;
}
