import { prisma } from "@/lib/db/client";
import { isUuid } from "@/lib/storage/keys";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  try {
    const beat = await prisma.beat.findFirst({ where: { id, publishedAt: { not: null }, status: { in: ["available", "reserved", "sold"] } }, select: { coverKey: true } });
    if (!beat?.coverKey) return new Response(null, { status: 404 });
    const storage = new ContaboS3Storage(getS3Config());
    const { url } = await storage.createSignedDownloadUrl({ visibility: "public", key: beat.coverKey }, { expiresInSeconds: 300 });
    const upstream = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]) });
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 503 });
    return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
