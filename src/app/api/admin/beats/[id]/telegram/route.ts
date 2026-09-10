import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { publishBeatToTelegram } from "@/lib/telegram/beats";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const beat = await prisma.beat.findUnique({
    where: { id },
    select: {
      title: true, slug: true, genre: true, substyle: true, bpm: true, mood: true,
      priceRub: true, priceUsd: true, coverKey: true, previewKey: true,
    },
  });

  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });

  try {
    const result = await publishBeatToTelegram({
      title: beat.title,
      slug: beat.slug,
      genre: beat.genre,
      substyle: beat.substyle ?? "",
      bpm: beat.bpm ?? 0,
      mood: beat.mood ?? "",
      priceRub: beat.priceRub ?? 0,
      priceUsd: beat.priceUsd,
      coverImageUrl: resolvePublicObjectUrl(beat.coverKey),
      previewUrl: resolvePublicObjectUrl(beat.previewKey),
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "Telegram is not configured on the server." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (publishError) {
    console.error("[telegram] manual beat publish failed", {
      error: publishError instanceof Error ? publishError.message : "unknown",
      beatId: id,
      beatSlug: beat.slug,
    });
    return NextResponse.json({ ok: false, error: "Failed to publish beat to Telegram." }, { status: 502 });
  }
}
