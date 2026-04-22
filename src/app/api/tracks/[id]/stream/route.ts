import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { TRACK_DOWNLOADS_BUCKET } from "@/lib/storage/media";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Returns a short-lived signed URL for in-browser streaming (no download log).
// Auth not required — published tracks are meant to be heard.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return errorResponse("Supabase env is not configured.", 503);
  }

  const { id } = await params;
  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof Error && error.message === "SUPABASE_ADMIN_NOT_CONFIGURED") {
      return errorResponse("Supabase admin env is not configured.", 503);
    }

    throw error;
  }

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("mp3_file_path")
    .eq("id", id)
    .maybeSingle<{ mp3_file_path: string | null }>();

  if (trackError || !track?.mp3_file_path) {
    return errorResponse("Audio is not available for this track.", 404);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(TRACK_DOWNLOADS_BUCKET)
    .createSignedUrl(track.mp3_file_path, 3600);

  if (signedError || !signed?.signedUrl) {
    return errorResponse(signedError?.message ?? "Failed to generate stream URL.", 500);
  }

  return NextResponse.json({ url: signed.signedUrl });
}
