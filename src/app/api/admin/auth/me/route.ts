import { jsonNoStore } from "@/lib/auth/response";
import { getAdminSessionState } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  let state;
  try {
    state = await getAdminSessionState();
  } catch {
    return jsonNoStore({ authenticated: false }, { status: 401 });
  }

  if (!state.isAuthenticated) {
    return jsonNoStore({ authenticated: false }, { status: 401 });
  }

  return jsonNoStore({
    authenticated: true,
    user: { email: state.email, role: state.role },
    session: { expiresAt: state.expiresAt, shouldRefresh: state.shouldRefresh },
  });
}
