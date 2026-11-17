import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { orderDeliverySchema } from "@/lib/validations/order-delivery";

export const runtime = "nodejs";
export async function PUT(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orderId } = await params;
  const input = orderDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Укажите корректную HTTPS-ссылку на MP3 или страницу скачивания." }, { status: 400 });
  const deliveryMp3Url = input.data.url || null;
  const saved = await prisma.order.updateMany({ where: { id: orderId, status: { in: ["paid", "pending_free_checkout"] } }, data: { deliveryMp3Url } });
  if (!saved.count) return NextResponse.json({ error: "Подтверждённая покупка не найдена." }, { status: 409 });
  return NextResponse.json({ ok: true, deliveryMp3Url }, { headers: { "Cache-Control": "no-store" } });
}
