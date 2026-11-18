import { NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getAccountSummary } from "@/lib/account/summary";
export const runtime = "nodejs";
export async function GET() {
  try {
    const session = await getPublicSessionState();
    if (!session.isAuthenticated || !session.userId) return NextResponse.json({ error: "Login required" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const summary = await getAccountSummary(session.userId);
    return NextResponse.json(summary ?? { error: "Account not found" }, { status: summary ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Account temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
