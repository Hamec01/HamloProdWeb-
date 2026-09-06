import { NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ favorites: [], isAuthenticated: false });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ favorites: [], isAuthenticated: false });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("track_id")
    .eq("user_id", session.userId);

  if (error || !data) {
    return NextResponse.json({ favorites: [], isAuthenticated: true });
  }

  return NextResponse.json({ favorites: data.map((f: { track_id: string }) => f.track_id), isAuthenticated: true });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trackId, isFavorite } = (await request.json()) as { trackId: string; isFavorite: boolean };

  const supabase = await createSupabaseServerClient();

  if (isFavorite) {
    const { error } = await supabase
      .from("favorites")
      .insert([{ user_id: session.userId, track_id: trackId }]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", session.userId)
    .eq("track_id", trackId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
