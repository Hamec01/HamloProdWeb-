import { NextResponse, after } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { PrismaUploadIntentRepository } from "@/lib/data/postgres/upload-intent.postgres";
import { opportunisticUploadSweep } from "@/lib/storage/cleanup";
import { PrismaBeatRepository } from "@/lib/data/postgres/beat.postgres";
import { createUploadUrl } from "@/lib/storage/upload-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const storage = new ContaboS3Storage(getS3Config());
    const intents = new PrismaUploadIntentRepository();
    after(() => opportunisticUploadSweep(intents, storage));
    const result = await createUploadUrl({ isAuthorized: true, sameOrigin: true, ownerId: guard.context.userId, body, storage, intents, beatExists: async id => Boolean(await new PrismaBeatRepository().findById(id)) });
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Storage operation failed." }, { status: 500 });
  }
}
