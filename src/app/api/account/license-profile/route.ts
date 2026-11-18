import { NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
import { prisma } from "@/lib/db/client";
import { licenseProfileSchema } from "@/lib/account/license-profile";

export async function PUT(request: Request) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;
  const input = licenseProfileSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "Проверьте данные." }, { status: 400 });
  try {
    await prisma.buyerLicenseProfile.upsert({ where: { userId: guard.context.userId }, create: { userId: guard.context.userId, ...input.data }, update: input.data });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить данные. Повторите попытку." }, { status: 503 });
  }
}
