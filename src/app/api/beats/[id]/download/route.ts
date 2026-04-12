import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { BEAT_PREVIEWS_BUCKET } from "@/lib/storage/media";

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
  const { data: beat, error: beatError } = await supabase
    .from("beats")
    .select("id, title, preview_url, preview_storage_path, available_for_download")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      preview_url: string;
      preview_storage_path: string | null;
      available_for_download: boolean;
    }>();

  if (beatError || !beat) {
    return errorResponse("Beat not found.", 404);
  }

  if (!beat.available_for_download) {
    return errorResponse("Downloads are not available for this beat.", 404);
  }

  const { error: logError } = await supabase.from("beat_downloads").insert({
    beat_id: beat.id,
    beat_title: beat.title,
    file_format: "mp3",
    user_id: user.id,
    user_email: user.email ?? "unknown",
  });

  if (logError) {
    return errorResponse(logError.message, 400);
  }

  if (!beat.preview_storage_path) {
    return NextResponse.json({ url: beat.preview_url, format: "mp3" });
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from(BEAT_PREVIEWS_BUCKET)
    .createSignedUrl(beat.preview_storage_path, 60);

  if (signedError || !signedData?.signedUrl) {
    return errorResponse(signedError?.message ?? "Failed to prepare download.", 400);
  }

  return NextResponse.json({ url: signedData.signedUrl, format: "mp3" });
}
