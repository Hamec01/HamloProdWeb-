import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { userAdminGuard, privateHeaders, userError } from "@/lib/users/http";
import { beatDeliverySchema } from "@/lib/delivery/beat-delivery";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const guard = await userAdminGuard(request); if (!guard.ok) return guard.response;
  const { id: beatId } = await params;
  if (!z.uuid().safeParse(beatId).success) return NextResponse.json({ error: "Invalid beat" }, { status: 400 });
  try {
    const beat = await prisma.beat.findUnique({ where: { id: beatId }, select: { id: true, slug: true, archiveKey: true } });
    if (!beat) return NextResponse.json({ error: "Бит не найден." }, { status: 404 });
    const delivery = await prisma.beatDelivery.findUnique({ where: { beatId }, select: { url: true } });
    return NextResponse.json({ url: delivery?.url ?? "", hasArchive: Boolean(beat.archiveKey) }, { headers: privateHeaders });
  } catch (error) { return userError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  const guard = await userAdminGuard(request, true); if (!guard.ok) return guard.response;
  const { id: beatId } = await params;
  const input = beatDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(beatId).success || !input.success) return NextResponse.json({ error: "Укажите HTTPS-ссылку на файл или папку Google Диска." }, { status: 400 });
  try {
    const beat = await prisma.beat.findUnique({ where: { id: beatId }, select: { id: true, slug: true, archiveKey: true } });
    if (!beat) return NextResponse.json({ error: "Бит не найден." }, { status: 404 });
    if (input.data.url) await prisma.beatDelivery.upsert({ where: { beatId }, create: { beatId, url: input.data.url }, update: { url: input.data.url } });
    else await prisma.beatDelivery.deleteMany({ where: { beatId } });
    revalidatePath("/admin/licenses"); revalidatePath("/beats"); revalidatePath(`/beats/${beat.slug}`);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return userError(error); }
}
