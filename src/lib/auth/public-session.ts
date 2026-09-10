/**
 * Buyer (public) session state — PostgreSQL-backed own auth. Server-only.
 *
 * Read-only: reads the `hp_session` cookie and validates it. Never writes a
 * cookie. Cookie writes happen only in the `/api/auth/*` Route Handlers.
 */

import { cookies } from "next/headers";
import { publicCookieName } from "@/lib/auth/public-cookies";
import { validatePublicSessionToken } from "@/lib/auth/public-session-store";

export type PublicSessionState = {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  role: string | null;
  artistId: string | null;
  sessionId: string | null;
};

const UNAUTHENTICATED: PublicSessionState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  role: null,
  artistId: null,
  sessionId: null,
};

export async function getPublicSessionState(): Promise<PublicSessionState> {
  const store = await cookies();
  const token = store.get(publicCookieName())?.value;
  const session = await validatePublicSessionToken(token);

  if (!session) {
    return UNAUTHENTICATED;
  }

  return {
    isAuthenticated: true,
    userId: session.userId,
    email: session.email,
    role: session.role,
    artistId: session.artistId,
    sessionId: session.sessionId,
  };
}
