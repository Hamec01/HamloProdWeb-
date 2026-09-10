import { getPublicSessionState } from "@/lib/auth/public-session";
import { jsonNoStore } from "@/lib/auth/response";

export const runtime = "nodejs";

export async function GET() {
  const state = await getPublicSessionState();
  if (!state.isAuthenticated) {
    return jsonNoStore({ authenticated: false }, { status: 200 });
  }
  return jsonNoStore({
    authenticated: true,
    user: { email: state.email, role: state.role },
  });
}
