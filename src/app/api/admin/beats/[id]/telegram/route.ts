import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { publishBeatToTelegram } from "@/lib/telegram/beats";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TelegramBeatRow = {
  title: string;
  slug: string;
  genre: string;
  substyle: string;
  bpm: number;
  mood: string;
  price_rub: number | null;
  price_usd: number;
  cover_image_url: string | null;
  preview_url: string | null;
};

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }

  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: beat, error } = await supabase
    .from("beats")
    .select("title, slug, genre, substyle, bpm, mood, price_rub, price_usd, cover_image_url, preview_url")
    .eq("id", id)
    .maybeSingle<TelegramBeatRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!beat) {
    return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  }

  try {
    const result = await publishBeatToTelegram({
      title: beat.title,
      slug: beat.slug,
      genre: beat.genre,
      substyle: beat.substyle,
      bpm: beat.bpm,
      mood: beat.mood,
      priceRub: beat.price_rub ?? 0,
      priceUsd: beat.price_usd,
      coverImageUrl: beat.cover_image_url,
      previewUrl: beat.preview_url,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "Telegram is not configured on the server." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (publishError) {
    console.error("[telegram] manual beat publish failed", {
      error: publishError,
      beatId: id,
      beatSlug: beat.slug,
    });

    return NextResponse.json({ ok: false, error: "Failed to publish beat to Telegram." }, { status: 502 });
  }
}
