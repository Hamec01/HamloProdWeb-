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

  const existingTracksResult = await supabase
    .from("tracks")
    .select("id")
    .eq("release_id", id)
    .returns<Array<{ id: string }>>();

  if (existingTracksResult.error) {
    return NextResponse.json({ error: existingTracksResult.error.message }, { status: 500 });
  }

  const existingTrackIds = new Set((existingTracksResult.data ?? []).map((track) => track.id));
  const incomingTrackIds = new Set(tracks.map((track) => track.id).filter((trackId): trackId is string => Boolean(trackId)));

  const detachedTrackIds = [...existingTrackIds].filter((trackId) => !incomingTrackIds.has(trackId));
  if (detachedTrackIds.length > 0) {
    const { error: detachError } = await supabase
      .from("tracks")
      .update({ release_id: null, track_number: null })
      .in("id", detachedTrackIds);

    if (detachError) {
      return NextResponse.json({ error: detachError.message }, { status: 500 });
    }
  }

  for (const track of tracks) {
    const trackPayload = {
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
      release_id: id,
      track_number: track.trackNumber,
    };

    if (track.id && existingTrackIds.has(track.id)) {
      const { error: updateTrackError } = await supabase
        .from("tracks")
        .update(trackPayload)
        .eq("id", track.id);

      if (updateTrackError) {
        return NextResponse.json({ error: updateTrackError.message }, { status: 500 });
      }

      continue;
    }

    const existingBySlug = await supabase
      .from("tracks")
      .select("id, release_id")
      .eq("slug", track.slug)
      .maybeSingle<{ id: string; release_id: string | null }>();

    if (existingBySlug.error) {
      return NextResponse.json({ error: existingBySlug.error.message }, { status: 500 });
    }

    if (existingBySlug.data) {
      if (existingBySlug.data.release_id && existingBySlug.data.release_id !== id) {
        return NextResponse.json(
          { error: `Track slug \"${track.slug}\" уже используется в другом релизе.` },
          { status: 400 },
        );
      }

      const { error: attachTrackError } = await supabase
        .from("tracks")
        .update(trackPayload)
        .eq("id", existingBySlug.data.id);

      if (attachTrackError) {
        return NextResponse.json({ error: attachTrackError.message }, { status: 500 });
      }

      continue;
    }

    const { error: insertTrackError } = await supabase.from("tracks").insert(trackPayload);
    if (insertTrackError) {
      return NextResponse.json({ error: insertTrackError.message }, { status: 500 });
    }
  }

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
