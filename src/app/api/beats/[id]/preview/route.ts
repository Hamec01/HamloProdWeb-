import { prisma } from "@/lib/db/client";
import { isUuid } from "@/lib/storage/keys";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(status: number) {
  return Response.json({ error: "Audio is temporarily unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return error(404);
  const range = request.headers.get("range");
  if (range && (!/^bytes=(\d+-\d*|-\d+)$/.test(range) || range.length > 100)) return error(416);
  try {
    const beat = await prisma.beat.findFirst({
      where: { id, publishedAt: { not: null }, status: { in: ["available", "reserved"] } },
      select: { previewKey: true },
    });
    if (!beat?.previewKey) return error(404);
    const storage = new ContaboS3Storage(getS3Config());
    const { url } = await storage.createSignedDownloadUrl({ visibility: "public", key: beat.previewKey }, { expiresInSeconds: 300 });
    const upstream = await fetch(url, {
      headers: range ? { Range: range } : {},
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
      cache: "no-store",
      redirect: "error",
    });
    if (upstream.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": upstream.headers.get("content-range") ?? "bytes */0" } });
    if (!upstream.ok || !upstream.body) { await upstream.body?.cancel(); return error(503); }
    const headers = new Headers({
      "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes",
      "Content-Disposition": "inline", "Cache-Control": "private, no-store",
    });
    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Stream the public preview only; never load private masters into this route.
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return error(503);
  }
}
