import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrderActor } from "@/lib/orders/access";
import { getUserConversation, sendUserMessage } from "@/lib/users/service";
import { messageInput } from "@/lib/users/validation";
import { privateHeaders, userError } from "@/lib/users/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ userId: string }> };
export async function GET(request: Request, { params }: Context) {
  const guard = await requireOrderActor(request, false);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const before = new URL(request.url).searchParams.get("before") || undefined;
  if (!z.uuid().safeParse(userId).success || (before && !z.uuid().safeParse(before).success)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { return NextResponse.json(await getUserConversation(userId, guard.actor, before), { headers: privateHeaders }); }
  catch (error) { return userError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const guard = await requireOrderActor(request, true);
  if (!guard.ok) return guard.response;
  const { userId } = await params;
  const input = messageInput.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(userId).success || !input.success) return NextResponse.json({ error: "Сообщение должно содержать от 1 до 4000 символов." }, { status: 400 });
  try { return NextResponse.json(await sendUserMessage(userId, guard.actor, input.data.text, input.data.clientMessageId), { status: 201, headers: privateHeaders }); }
  catch (error) { return userError(error); }
}
