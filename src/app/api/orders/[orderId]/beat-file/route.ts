import { NextResponse } from "next/server";
import { z } from "zod";
import { orderActor } from "@/lib/orders/access";
import { prisma } from "@/lib/db/client";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const actor = await orderActor();
  if (!actor) return NextResponse.json({ error: "Login required." }, { status: 401, headers });
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400, headers });
  const order = await prisma.order.findFirst({ where: { id: orderId, ...(actor.role === "buyer" ? { buyerUserId: actor.userId } : {}) }, select: { status: true, deliveryArchiveKey: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404, headers });
  if (!["paid", "pending_free_checkout"].includes(order.status)) return NextResponse.json({ error: "Payment is not confirmed." }, { status: 409, headers });
  if (!order.deliveryArchiveKey) return NextResponse.json({ error: "ZIP is not attached to this purchase." }, { status: 404, headers });
  try {
    const signed = await new ContaboS3Storage(getS3Config()).createSignedDownloadUrl({ visibility: "private", key: order.deliveryArchiveKey }, { expiresInSeconds: 300, downloadName: `HamloProd-${orderId}.zip` });
    return NextResponse.redirect(signed.url, { headers });
  } catch { return NextResponse.json({ error: "Не удалось подготовить ZIP. Повторите скачивание позже." }, { status: 503, headers }); }
}
