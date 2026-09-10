import { cookies } from "next/headers";
import { ALL_PUBLIC_COOKIE_NAMES, clearedPublicCookieOptions, publicCookieName } from "@/lib/auth/public-cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { jsonNoStore } from "@/lib/auth/response";
import { logoutBuyer } from "@/lib/auth/public-auth-service";
import { publicLogoutPorts } from "@/lib/auth/public-ports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(publicCookieName())?.value;

  let result;
  try {
    result = await logoutBuyer({
      ports: publicLogoutPorts(),
      token,
      sameOrigin: isSameOriginRequest(request),
    });
  } catch (error) {
    console.error("[auth/logout] revoke failed", error instanceof Error ? error.message : "unknown");
    return jsonNoStore({ error: "Could not sign out. Please try again." }, { status: 503 });
  }

  const response = jsonNoStore(result.body, { status: result.status });
  if (result.clearSession) {
    for (const name of ALL_PUBLIC_COOKIE_NAMES) {
      response.cookies.set(name, "", clearedPublicCookieOptions());
    }
  }
  return response;
}
