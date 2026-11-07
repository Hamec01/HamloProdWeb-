import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { diaryEntrySchema } from "@/lib/validations/developer-diary";
import { diaryPostFields } from "@/lib/diary/posts";
import { revalidateDiary } from "@/lib/diary/revalidate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  const parsed = diaryEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry." }, { status: 400 });
  try {
    const post = await prisma.post.create({ data: { ...diaryPostFields(parsed.data), slug: `devlog-${randomUUID()}` }, select: { id: true } });
    revalidateDiary();
    return NextResponse.json({ id: post.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить запись. Текст остался в редакторе." }, { status: 503 });
  }
}
