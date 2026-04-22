import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { releaseFormSchema } from "@/lib/validations/release";

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

  const parsed = releaseFormSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const { tracks, ...releaseData } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // 1. Insert release
  const { data: release, error: releaseError } = await supabase
    .from("releases")
    .insert({
      title: releaseData.title,
      slug: releaseData.slug,
      artist_name: releaseData.artistName,
      release_type: releaseData.releaseType,
      cover_palette: releaseData.coverPalette,
      cover_image_url: releaseData.coverImageUrl,
      cover_image_path: releaseData.coverImagePath,
      description: releaseData.description,
      spotify_url: releaseData.spotifyUrl,
      apple_music_url: releaseData.appleMusicUrl,
      youtube_url: releaseData.youtubeUrl,
      release_date: releaseData.releaseDate,
      published: releaseData.published,
      featured: releaseData.featured,
    })
    .select("id")
    .single();

  if (releaseError || !release) {
    return NextResponse.json({ error: releaseError?.message ?? "Failed to create release." }, { status: 500 });
  }

  // 2. Insert tracks linked to this release
  if (tracks.length > 0) {
    const trackRows = tracks.map((track) => ({
      title: track.title,
      slug: track.slug,
      artist_name: releaseData.artistName,
      cover_palette: releaseData.coverPalette,
      cover_image_url: releaseData.coverImageUrl,
      cover_image_path: releaseData.coverImagePath,
      mp3_file_path: track.mp3FilePath,
      spotify_url: releaseData.spotifyUrl,
      apple_music_url: releaseData.appleMusicUrl,
      youtube_url: releaseData.youtubeUrl,
      release_date: releaseData.releaseDate,
      release_id: release.id,
      track_number: track.trackNumber,
    }));

    const { error: tracksError } = await supabase.from("tracks").insert(trackRows);

    if (tracksError) {
      // Roll back release on track insert failure
      await supabase.from("releases").delete().eq("id", release.id);
      return NextResponse.json({ error: tracksError.message ?? "Failed to create tracks." }, { status: 500 });
    }
  }

  revalidatePath("/ru/ham");
  revalidatePath("/en/ham");
  revalidatePath("/admin/releases");

  return NextResponse.json({ id: release.id }, { status: 201 });
}
