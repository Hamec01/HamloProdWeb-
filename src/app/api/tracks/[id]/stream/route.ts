import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Published track audio is stored privately. The route resolves metadata from
// PostgreSQL and returns a short-lived signed Contabo URL for browser playback.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const track = await prisma.track.findUnique({ where: { id }, select: { audioKey: true } });

  if (!track?.audioKey) {
    return errorResponse("Audio is not available for this track.", 404);
  }

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const signed = await storage.createSignedDownloadUrl(
      { visibility: "private", key: track.audioKey },
      { expiresInSeconds: 900 },
    );
    return NextResponse.json({ url: signed.url });
  } catch (error) {
    console.error("[track-stream] failed to sign audio", {
      trackId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse("Audio is temporarily unavailable.", 503);
  }
}
