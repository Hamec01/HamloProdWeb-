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
  const track = await prisma.track.findUnique({
    where: { id },
    select: { id: true, title: true, audioKey: true },
  });

  if (!track?.audioKey) {
    return NextResponse.json({ error: "MP3 is not available for this track." }, { status: 404 });
  }

  await prisma.trackDownloadLog.create({
    data: {
      trackId: track.id,
      trackTitle: track.title,
      userId: guard.context.userId,
      userEmail: guard.context.email,
    },
  });

  const publicUrl = resolvePublicObjectUrl(track.audioKey);
  if (publicUrl) {
    return NextResponse.json({ url: publicUrl });
  }

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const signed = await storage.createSignedDownloadUrl(
      { visibility: "private", key: track.audioKey },
      { expiresInSeconds: 300 },
    );
    return NextResponse.json({ url: signed.url });
  } catch {
    return NextResponse.json({ error: "Failed to prepare download." }, { status: 503 });
  }
}
