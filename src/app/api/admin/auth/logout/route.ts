import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCookieName, ALL_ADMIN_COOKIE_NAMES, clearedAdminCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { logoutAdmin } from "@/lib/auth/admin-auth-service";
import { logoutPorts } from "@/lib/auth/admin-ports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(adminCookieName())?.value;

  let result;
  try {
    result = await logoutAdmin({
      ports: logoutPorts(),
      token,
      sameOrigin: isSameOriginRequest(request),
    });
  } catch (error) {
    console.error("[admin/auth/logout] error", error instanceof Error ? error.message : error);
    // Still clear the cookie — logout must not get stuck.
    result = { status: 200, body: { ok: true }, clearSession: true };
  }

  const response = NextResponse.json(result.body, { status: result.status });

  if (result.clearSession) {
    for (const name of ALL_ADMIN_COOKIE_NAMES) {
      response.cookies.set(name, "", clearedAdminCookieOptions());
    }
  }

  return response;
}
