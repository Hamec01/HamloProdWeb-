import { redirect } from "next/navigation";
import { canManageContent } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export type AdminSessionState = {
  hasSupabase: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  email: string | null;
};

export async function getAdminSessionState(): Promise<AdminSessionState> {
  if (!hasSupabaseEnv()) {
    return {
      hasSupabase: false,
      isAuthenticated: false,
      role: null,
      email: null,
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
      role: null,
      email: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole | undefined) ?? null;

  return {
    hasSupabase: true,
    isAuthenticated: Boolean(role && canManageContent(role)),
    role,
    email: user.email ?? null,
  };
}

export async function requireAdminSession() {
  const session = await getAdminSessionState();

  if (!session.hasSupabase) {
    return session;
  }

  if (!session.isAuthenticated) {
    redirect("/admin/login");
  }

  return session;
}