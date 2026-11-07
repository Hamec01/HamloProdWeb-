import { NextResponse } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { generateObjectKey, isUuid } from "@/lib/storage/keys";
import { downloadRemoteDiaryImage } from "@/lib/diary/remote-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Хранилище изображений не настроено." }, { status: 503 });
  const body = await request.json().catch(() => null) as { url?: unknown; ownerId?: unknown } | null;
  if (!body || typeof body.url !== "string" || typeof body.ownerId !== "string" || !isUuid(body.ownerId) || body.url.length > 4_000) {
    return NextResponse.json({ error: "Некорректная картинка из буфера." }, { status: 400 });
  }
  try {
    const image = await downloadRemoteDiaryImage(body.url);
    const key = generateObjectKey({ kind: "post-file", entityId: body.ownerId, originalFileName: `pasted.${image.extension}` }).key;
    const storage = new ContaboS3Storage(getS3Config());
    await storage.putObject({ visibility: "public", key, body: image.bytes, contentType: image.contentType, contentLength: image.bytes.byteLength });
    return NextResponse.json({ publicUrl: storage.publicUrlForKey(key) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить картинку из буфера." }, { status: 422 });
  }
}
