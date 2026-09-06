import { cookies } from "next/headers";
import { adminCookieName, ALL_ADMIN_COOKIE_NAMES, clearedAdminCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { jsonNoStore } from "@/lib/auth/response";
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
    // The revoke did not persist. Do NOT clear the cookie and do NOT report
    // success — the user can retry. The raw token is not logged.
    console.error("[admin/auth/logout] revoke failed", error instanceof Error ? error.message : "unknown");
    return jsonNoStore({ error: "Could not sign out. Please try again." }, { status: 503 });
  }

  const response = jsonNoStore(result.body, { status: result.status });

  if (result.clearSession) {
    for (const name of ALL_ADMIN_COOKIE_NAMES) {
      response.cookies.set(name, "", clearedAdminCookieOptions());
    }
  }

  return response;
}
