import { NextResponse } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { licenseSellerSchema } from "@/lib/validations/license-seller";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.text();
  if (body.length > 750_000) return NextResponse.json({ error: "Изображение подписи слишком большое." }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = licenseSellerSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Проверьте ФИО, email и остальные поля. Подпись — PNG или JPEG до 500 КБ." }, { status: 400 });
  await prisma.licenseSellerSetting.upsert({
    where: { id: "default" },
    create: { id: "default", identity: parsed.data },
    update: { identity: parsed.data },
  });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
