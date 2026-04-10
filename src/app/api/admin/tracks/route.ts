import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { trackFormSchema } from "@/lib/validations/track";

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
  const parsed = trackFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const values = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tracks").insert({
    title: values.title,
    slug: values.slug,
    artist_name: values.artistName,
    cover_palette: values.coverPalette,
    cover_image_url: values.coverImageUrl,
    cover_image_path: values.coverImagePath,
    mp3_file_path: values.mp3FilePath,
    spotify_url: values.spotifyUrl,
    apple_music_url: values.appleMusicUrl,
    youtube_url: values.youtubeUrl,
    release_date: values.releaseDate,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/tracks");
  revalidatePath("/admin/tracks");

  return NextResponse.json({ ok: true });
}