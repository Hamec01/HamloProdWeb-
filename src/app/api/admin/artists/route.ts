import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { artistFormSchema } from "@/lib/validations/artist";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }

  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const body = await request.json();
  const parsed = artistFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const values = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("artists").insert({
    artist_name: values.artistName,
    track_title: values.trackTitle,
    beat_title: values.beatTitle,
    cover_palette: values.coverPalette,
    spotify_url: values.spotifyUrl,
    apple_music_url: values.appleMusicUrl,
    youtube_url: values.youtubeUrl,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/artists");
  revalidatePath("/admin/artists");

  return NextResponse.json({ ok: true });
}