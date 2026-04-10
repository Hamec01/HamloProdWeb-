import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { TRACK_DOWNLOADS_BUCKET } from "@/lib/storage/media";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return errorResponse("Supabase env is not configured.", 503);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Login required.", 401);
  }

  const { id } = await params;
  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("id, title, mp3_file_path")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; mp3_file_path: string | null }>();

  if (trackError || !track?.mp3_file_path) {
    return errorResponse("MP3 is not available for this track.", 404);
  }

  const { error: logError } = await supabase.from("track_downloads").insert({
    track_id: track.id,
    track_title: track.title,
    user_id: user.id,
    user_email: user.email ?? "unknown",
  });

  if (logError) {
    return errorResponse(logError.message, 400);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(TRACK_DOWNLOADS_BUCKET)
    .createSignedUrl(track.mp3_file_path, 60);

  if (signedError || !signedData?.signedUrl) {
    return errorResponse(signedError?.message ?? "Failed to prepare download.", 400);
  }

  return NextResponse.json({ url: signedData.signedUrl });
}