import { NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { BEAT_DOWNLOADS_BUCKET } from "@/lib/storage/media";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type OrderBeatRow = {
  id: string;
  status: string;
  buyer_user_id: string;
  beat_id: string;
  beats: {
    wav_file_path: string | null;
    zip_file_path: string | null;
  } | null;
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseEnv()) return err("Supabase not configured.", 503);

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) return err("Unauthorized", 401);

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, buyer_user_id, beat_id, beats(wav_file_path, zip_file_path)")
    .eq("id", id)
    .maybeSingle<OrderBeatRow>();

  if (!order) return err("Order not found.", 404);
  if (order.buyer_user_id !== session.userId) return err("Forbidden.", 403);
  if (order.status !== "paid") return err("Order is not paid.", 402);

  const beat = order.beats;
  if (!beat?.wav_file_path && !beat?.zip_file_path) {
    return err("No download files available for this beat.", 404);
  }

  const links: { format: string; url: string }[] = [];
  const EXPIRY = 60 * 60 * 24 * 365 * 10; // 10 years — effectively permanent

  for (const [format, path] of [
    ["wav", beat.wav_file_path],
    ["zip", beat.zip_file_path],
  ] as [string, string | null][]) {
    if (!path) continue;
    const { data } = await supabase.storage
      .from(BEAT_DOWNLOADS_BUCKET)
      .createSignedUrl(path, EXPIRY);
    if (data?.signedUrl) {
      links.push({ format, url: data.signedUrl });
    }
  }

  if (links.length === 0) return err("Could not generate download links.", 500);

  return NextResponse.json({ links });
}
