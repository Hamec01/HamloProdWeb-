import { NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  // RLS handles authorization (only admin or owning artist can delete)
  const { error } = await supabase.from("artist_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
