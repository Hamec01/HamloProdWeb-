import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { resolvePublicObjectUrl } from "@/lib/storage/public-url";
import { extensionFromFileName } from "@/lib/storage/keys";

export const runtime = "nodejs";

const schema = z.object({
  artistId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  published: z.boolean().default(true),
});

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"]);
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_AUDIO = 40 * 1024 * 1024;

async function storeArtistPostFile(
  storage: ContaboS3Storage,
  artistId: string,
  file: File,
  kind: "image" | "audio",
): Promise<string | null> {
  const allowed = kind === "image" ? IMAGE_MIME : AUDIO_MIME;
  const max = kind === "image" ? MAX_IMAGE : MAX_AUDIO;
  if (!allowed.has(file.type) || file.size <= 0 || file.size > max) return null;
  const ext = extensionFromFileName(file.name) ?? (kind === "image" ? "jpg" : "mp3");
  const key = `artists/${artistId}/post-${kind}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await storage.putObject({ visibility: "public", key, body: bytes, contentType: file.type, contentLength: bytes.byteLength });
    return key;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let raw: Record<string, unknown>;
  let imageFile: File | null = null;
  let audioFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    raw = {
      artistId: form.get("artistId"),
      title: form.get("title"),
      body: form.get("body"),
      published: form.get("published") !== "false",
    };
    const img = form.get("image");
    const aud = form.get("audio");
    if (img instanceof File && img.size > 0) imageFile = img;
    if (aud instanceof File && aud.size > 0) audioFile = aud;
  } else {
    raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }
  const { artistId, title, body, published } = parsed.data;

  const isAdmin = session.role === "ADMIN" || session.role === "EDITOR";
  const isOwner = session.artistId === artistId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } });
  if (!artist) return NextResponse.json({ error: "Artist not found." }, { status: 404 });

  let imageKey: string | null = null;
  let audioKey: string | null = null;
  if ((imageFile || audioFile) && isStorageConfigured()) {
    const storage = new ContaboS3Storage(getS3Config());
    if (imageFile) imageKey = await storeArtistPostFile(storage, artistId, imageFile, "image");
    if (audioFile) audioKey = await storeArtistPostFile(storage, artistId, audioFile, "audio");
  }

  const created = await prisma.artistPost.create({
    data: { artistId, authorId: session.userId, title, body, imageKey, audioKey, published },
  });

  revalidatePath("/ru/artists");
  revalidatePath("/en/artists");

  return NextResponse.json({
    ok: true,
    post: {
      id: created.id,
      artistId: created.artistId,
      authorId: created.authorId,
      title: created.title,
      body: created.body,
      imageUrl: resolvePublicObjectUrl(created.imageKey),
      imagePath: created.imageKey,
      audioUrl: resolvePublicObjectUrl(created.audioKey),
      audioPath: created.audioKey,
      published: created.published,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
