/**
 * Generic admin media upload — cover / audio / avatar / post file for tracks,
 * releases, posts and artists. Admin-trusted (requireAdminMutation), so it does
 * NOT use the UploadIntent state machine (that stays beat-only to protect the
 * one-buyer sale invariant). The returned key is written straight into the
 * entity's metadata row by the matching admin CRUD route.
 */

import { NextResponse } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { generateObjectKey, isUploadKind, UnsafeObjectKeyError } from "@/lib/storage/keys";
import { validateUploadRequest, visibilityForKind } from "@/lib/storage/upload-rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { kind, entityId, contentType, size, originalFileName } = (body ?? {}) as Record<string, unknown>;

  if (typeof kind !== "string" || !isUploadKind(kind) || kind.startsWith("beat-")) {
    return NextResponse.json({ error: "Unsupported upload kind for this endpoint.", code: "INVALID_UPLOAD_KIND" }, { status: 400 });
  }
  if (typeof entityId !== "string" || typeof contentType !== "string" || typeof originalFileName !== "string" || typeof size !== "number") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const validation = validateUploadRequest({ kind, contentType, originalFileName, size });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message, code: validation.code }, { status: 422 });
  }

  let key: string;
  try {
    key = generateObjectKey({ kind, entityId, originalFileName }).key;
  } catch (error) {
    if (error instanceof UnsafeObjectKeyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not generate a storage key." }, { status: 400 });
  }

  const visibility = visibilityForKind(kind);

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const signed = await storage.createSignedUploadUrl({
      visibility,
      key,
      contentType: validation.contentType,
      expiresInSeconds: 300,
    });
    return NextResponse.json(
      {
        key,
        kind,
        visibility,
        upload: { url: signed.url, method: signed.method, headers: signed.headers },
        expiresAt: signed.expiresAt,
        publicUrl: visibility === "public" ? storage.publicUrlForKey(key) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Storage operation failed." }, { status: 500 });
  }
}
