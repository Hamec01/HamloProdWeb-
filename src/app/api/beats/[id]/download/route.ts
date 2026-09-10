import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const beat = await prisma.beat.findUnique({
    where: { id },
    select: { id: true, title: true, previewKey: true, availableForDownload: true },
  });

  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  if (!beat.availableForDownload || !beat.previewKey) {
    return NextResponse.json({ error: "Downloads are not available for this beat." }, { status: 404 });
  }

  await prisma.beatDownloadLog.create({
    data: {
      beatId: beat.id,
      beatTitle: beat.title,
      fileFormat: "mp3",
      userId: guard.context.userId,
      userEmail: guard.context.email,
    },
  });

  // Legacy beat previews live in the public bucket (legacy-supabase/beat-previews/…).
  const publicUrl = resolvePublicObjectUrl(beat.previewKey);
  if (publicUrl) {
    return NextResponse.json({ url: publicUrl, format: "mp3" });
  }

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const signed = await storage.createSignedDownloadUrl(
      { visibility: "private", key: beat.previewKey },
      { expiresInSeconds: 300 },
    );
    return NextResponse.json({ url: signed.url, format: "mp3" });
  } catch {
    return NextResponse.json({ error: "Failed to prepare download." }, { status: 503 });
  }
}
