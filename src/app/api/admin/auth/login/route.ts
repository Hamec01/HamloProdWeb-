import { cookies } from "next/headers";
import { isAuthConfigured } from "@/lib/auth/config";
import { adminCookieName, adminCookieOptions } from "@/lib/auth/cookies";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { clientInfo } from "@/lib/auth/request";
import { jsonNoStore } from "@/lib/auth/response";
import { loginAdmin } from "@/lib/auth/admin-auth-service";
import { loginPorts } from "@/lib/auth/admin-ports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const { ip, userAgent } = clientInfo(request);

  let result;
  try {
    result = await loginAdmin({
      ports: loginPorts(),
      body,
      ip,
      userAgent,
      sameOrigin: isSameOriginRequest(request),
    });
  } catch (error) {
    console.error("[admin/auth/login] error", error instanceof Error ? error.message : error);
    return jsonNoStore({ error: "Could not sign in." }, { status: 500 });
  }

  if (result.setSession) {
    const store = await cookies();
    store.set(adminCookieName(), result.setSession.token, adminCookieOptions(result.setSession.expiresAt));
  }

  const response = jsonNoStore(result.body, { status: result.status });

  if (result.status === 429 && typeof result.body.retryAfterSeconds === "number") {
    response.headers.set("Retry-After", String(result.body.retryAfterSeconds));
  }

  return response;
}
