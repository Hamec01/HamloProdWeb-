import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { releaseFormSchema } from "@/lib/validations/release";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }
  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const { id } = await params;

  const parsed = releaseFormSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const { tracks, ...releaseData } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // Update release record
  const { error: releaseError } = await supabase
    .from("releases")
    .update({
      title: releaseData.title,
      slug: releaseData.slug,
      artist_name: releaseData.artistName,
      feat_artist_names: releaseData.featArtistNames ?? "",
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
    .eq("id", id);

  if (releaseError) {
    return NextResponse.json({ error: releaseError.message }, { status: 500 });
  }

  // Update shared metadata on all linked tracks (cover, artist, links, date)
  await supabase
    .from("tracks")
    .update({
      artist_name: releaseData.artistName,
      cover_palette: releaseData.coverPalette,
      cover_image_url: releaseData.coverImageUrl,
      cover_image_path: releaseData.coverImagePath,
      spotify_url: releaseData.spotifyUrl,
      apple_music_url: releaseData.appleMusicUrl,
      youtube_url: releaseData.youtubeUrl,
      release_date: releaseData.releaseDate,
    })
    .eq("release_id", id);

  revalidatePath("/ru/ham");
  revalidatePath("/en/ham");
  revalidatePath("/admin/releases");

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }
  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Nullify release_id on linked tracks (cascade handled by ON DELETE SET NULL, but explicit here)
  await supabase.from("tracks").update({ release_id: null, track_number: null }).eq("release_id", id);

  const { error } = await supabase.from("releases").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/ru/ham");
  revalidatePath("/en/ham");
  revalidatePath("/admin/releases");

  return NextResponse.json({ success: true });
}
