import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { finalizeUpload } from "@/lib/storage/upload-service";

export const runtime = "nodejs";

/**
 * POST /api/admin/storage/finalize
 *
 * Verifies a completed direct upload: requires an own-auth admin/editor session,
 * accepts only a previously issued key plus its kind, runs HeadObject, and checks
 * the real bucket / content type / size. It never accepts an arbitrary bucket or
 * a key that does not structurally match the kind.
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
    const result = await finalizeUpload({ isAuthorized: true, body, storage });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[storage/finalize] unexpected error", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not finalize the upload." }, { status: 500 });
  }
}
