import { NextResponse } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { assertSafeObjectKey, isUploadKind, keyMatchesKind, UnsafeObjectKeyError } from "@/lib/storage/keys";
import { validateFinalizedObject, visibilityForKind } from "@/lib/storage/upload-rules";

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

  const { kind, key } = (body ?? {}) as Record<string, unknown>;
  if (typeof kind !== "string" || !isUploadKind(kind) || kind.startsWith("beat-") || typeof key !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    assertSafeObjectKey(key);
  } catch (error) {
    if (error instanceof UnsafeObjectKeyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }

  if (!keyMatchesKind(key, kind)) {
    return NextResponse.json({ error: "Storage key does not match the declared kind.", code: "KEY_KIND_MISMATCH" }, { status: 400 });
  }

  const visibility = visibilityForKind(kind);

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const head = await storage.headObject({ visibility, key });
    if (!head) {
      return NextResponse.json({ error: "Uploaded object was not found in storage.", code: "OBJECT_NOT_FOUND" }, { status: 404 });
    }

    const validation = validateFinalizedObject({ kind, contentType: head.contentType, contentLength: head.contentLength });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message, code: validation.code }, { status: 422 });
    }

    return NextResponse.json(
      { key, kind, visibility, publicUrl: visibility === "public" ? storage.publicUrlForKey(key) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Storage operation failed." }, { status: 500 });
  }
}
