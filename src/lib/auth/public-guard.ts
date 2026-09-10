/**
 * Shared guard for state-changing buyer routes (favorites, reactions, ratings,
 * comments, purchases, downloads, checkout, payments, contracts).
 *
 *   1. Origin / Referer allow-list → foreign / missing → 403
 *   2. buyer session               → none              → 401
 *   3. auth / DB failure           →                     → 503
 *
 * `/api/auth/*` keeps its own specialised handling and does NOT use this.
 */

import { NextResponse } from "next/server";
import { getPublicSessionState, type PublicSessionState } from "@/lib/auth/public-session";
import { isSameOriginRequest } from "@/lib/auth/origin";

export type BuyerContext = { userId: string; email: string; role: string; artistId: string | null };

export type BuyerGuard =
  | { ok: true; context: BuyerContext }
  | { ok: false; response: NextResponse };

export async function requireBuyer(request: Request): Promise<BuyerGuard> {
  if (!isSameOriginRequest(request)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let state: PublicSessionState;
  try {
    state = await getPublicSessionState();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Authentication is not available." }, { status: 503 }) };
  }

  if (!state.isAuthenticated || !state.userId || !state.email) {
    return { ok: false, response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }

  return {
    ok: true,
    context: { userId: state.userId, email: state.email, role: state.role ?? "USER", artistId: state.artistId },
  };
}
