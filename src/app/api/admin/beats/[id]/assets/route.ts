import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminMutation } from "@/lib/auth/guard";
import { BeatService } from "@/lib/beats/service";
import { PrismaUploadIntentRepository } from "@/lib/data/postgres/upload-intent.postgres";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { opportunisticUploadSweep } from "@/lib/storage/cleanup";
export const runtime = "nodejs";
const schema = z.object({ kind: z.string(), key: z.string().max(1024) }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  const { id } = await params;
  try {
    const result = await new BeatService().attachAsset(id, parsed.data.kind, parsed.data.key, guard.context.role, guard.context.userId);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    for (const path of ["/", "/beats", "/admin/beats", "/ru/beats", "/en/beats", `/beats/${result.data.slug}`, `/ru/beats/${result.data.slug}`, `/en/beats/${result.data.slug}`]) revalidatePath(path);
    if (isStorageConfigured()) after(() => opportunisticUploadSweep(new PrismaUploadIntentRepository(), new ContaboS3Storage(getS3Config())));
    return NextResponse.json({ beat: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not attach asset." }, { status: 500 });
  }
}
