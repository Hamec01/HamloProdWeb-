import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrderActor, orderError } from "@/lib/orders/access";
import { getConversation, sendOrderMessage } from "@/lib/orders/conversation";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderActor(request, false);
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  const before = new URL(request.url).searchParams.get("before") || undefined;
  if (!z.uuid().safeParse(orderId).success || (before && !z.uuid().safeParse(before).success)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try { return NextResponse.json(await getConversation(orderId, guard.actor, before), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return orderError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderActor(request, true);
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  const input = z.object({ text: z.string().trim().min(1).max(4000), clientMessageId: z.uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(orderId).success || !input.success) return NextResponse.json({ error: "Сообщение должно содержать от 1 до 4000 символов." }, { status: 400 });
  try { return NextResponse.json(await sendOrderMessage(orderId, guard.actor, input.data.text, input.data.clientMessageId), { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return orderError(error); }
}
