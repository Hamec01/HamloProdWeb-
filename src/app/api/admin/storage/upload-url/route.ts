import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { createUploadUrl } from "@/lib/storage/upload-service";

// The AWS SDK / presigner require the Node.js runtime (not Edge).
export const runtime = "nodejs";

/**
 * POST /api/admin/storage/upload-url
 *
 * Issues a short-lived (5 min) presigned PUT for ONE server-generated key.
 * Requires an own-auth admin/editor session. Credentials never leave the server.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await getAdminSessionState();
  } catch {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  if (!session.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const result = await createUploadUrl({ isAuthorized: true, body, storage });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[storage/upload-url] unexpected error", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
  }
}
