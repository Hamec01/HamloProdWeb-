import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { diaryUpdateSchema } from "@/lib/validations/developer-diary";
import { diaryPostFields } from "@/lib/diary/posts";
import { revalidateDiary } from "@/lib/diary/revalidate";
import { isUuid } from "@/lib/storage/keys";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "no-store" };

export async function PUT(request: Request, { params }: Context) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Запись не найдена." }, { status: 404, headers });
  const parsed = diaryUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry." }, { status: 400, headers });
  try {
    const result = await prisma.post.updateMany({
      where: { id, section: "vst", updatedAt: new Date(parsed.data.updatedAt) }, data: diaryPostFields(parsed.data),
    });
    if (!result.count) return NextResponse.json({ error: "Запись уже изменена или удалена. Обнови дневник и открой её снова; твой текст остался в редакторе." }, { status: 409, headers });
    revalidateDiary();
    return NextResponse.json({ id }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить изменения. Текст остался в редакторе." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Запись не найдена." }, { status: 404, headers });
  try {
    const result = await prisma.post.deleteMany({ where: { id, section: "vst" } });
    if (!result.count) return NextResponse.json({ error: "Запись не найдена." }, { status: 404, headers });
    revalidateDiary();
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось удалить запись." }, { status: 503, headers });
  }
}
