/**
 * LEGACY public (buyer) session — still backed by Supabase Auth.
 *
 * Kept unchanged in M6.1; migrated to own auth in M6.2. Admin auth
 * (`src/lib/auth/session.ts`) no longer imports Supabase.
 */

import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicSessionState = {
  hasSupabase: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  artistId: string | null;
};

export async function getPublicSessionState(): Promise<PublicSessionState> {
  if (!hasSupabaseEnv()) {
    return {
      hasSupabase: false,
      isAuthenticated: false,
      userId: null,
      email: null,
      artistId: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasSupabase: true,
      isAuthenticated: false,
      userId: null,
      email: null,
      artistId: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("artist_id")
    .eq("id", user.id)
    .maybeSingle<{ artist_id: string | null }>();

  return {
    hasSupabase: true,
    isAuthenticated: true,
    userId: user.id,
    email: user.email ?? null,
    artistId: profile?.artist_id ?? null,
  };
}
