import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  let state;
  try {
    state = await getAdminSessionState();
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (!state.isAuthenticated) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: { email: state.email, role: state.role },
    session: { expiresAt: state.expiresAt, shouldRefresh: state.shouldRefresh },
  });
}
