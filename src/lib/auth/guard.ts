/**
 * Shared guard for state-changing `/api/admin/*` handlers.
 *
 * Order:
 *   1. Origin / Referer allow-list  → foreign / missing → 403
 *   2. own admin session            → no session        → 401
 *   3. auth / DB / config failure   →                     → 503
 *
 * Auth's own login / logout / refresh keep their specialised handling and do NOT
 * use this helper.
 */

import { NextResponse } from "next/server";
import type { AdminRole } from "@/lib/auth/admin-roles";
import { getAdminSessionState, type AdminSessionState } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin";

export type AdminMutationContext = { userId: string; role: AdminRole };

export type AdminMutationGuard =
  | { ok: true; context: AdminMutationContext }
  | { ok: false; status: 403 | 401 | 503; response: NextResponse };

export type AdminMutationDeps = {
  sameOrigin?: (request: Request) => boolean;
  getSession?: () => Promise<AdminSessionState>;
};

export async function requireAdminMutation(
  request: Request,
  deps: AdminMutationDeps = {},
): Promise<AdminMutationGuard> {
  const sameOrigin = deps.sameOrigin ?? isSameOriginRequest;
  const getSession = deps.getSession ?? getAdminSessionState;

  if (!sameOrigin(request)) {
    return { ok: false, status: 403, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let state: AdminSessionState;
  try {
    state = await getSession();
  } catch {
    return {
      ok: false,
      status: 503,
      response: NextResponse.json({ error: "Authentication is not available." }, { status: 503 }),
    };
  }

  if (!state.isAuthenticated || !state.userId || !state.role) {
    return { ok: false, status: 401, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, context: { userId: state.userId, role: state.role } };
}
