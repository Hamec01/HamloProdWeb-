import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { installerObjectKey, isInstallerFileName, MAX_INSTALLER_BYTES } from "@/lib/hpdg/release";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";

export const runtime = "nodejs";

const INSTALLER_CONTENT_TYPE = "application/octet-stream";

const schema = z.object({
  fileName: z.string().trim().refine(isInstallerFileName, "Installer file name must look like HPDG_VST3_Setup_0.1.0-beta.4.exe"),
  size: z.number().int().positive().max(MAX_INSTALLER_BYTES),
});

/**
 * Presigned PUT for `hamloprod-private/hpdg/<fileName>` — the browser uploads the
 * ~115 MB installer straight to Contabo. An existing object is never overwritten:
 * same name + same size → `exists: true` (just register the release).
 */
export async function POST(request: Request) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  try {
    const storage = new ContaboS3Storage(getS3Config());
    const object = { visibility: "private" as const, key: installerObjectKey(parsed.data.fileName) };
    const head = await storage.headObject(object);
    if (head) {
      if (head.contentLength === parsed.data.size) {
        return NextResponse.json({ key: object.key, exists: true }, { headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ error: `${object.key} already exists with a different size. Build the installer with a new version number.` }, { status: 409 });
    }
    const upload = await storage.createSignedUploadUrl({ ...object, contentType: INSTALLER_CONTENT_TYPE, expiresInSeconds: 600 });
    return NextResponse.json({ key: object.key, exists: false, upload }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Storage operation failed." }, { status: 500 });
  }
}
