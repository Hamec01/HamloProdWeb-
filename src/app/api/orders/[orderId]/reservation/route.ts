import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireOrderActor, orderError } from "@/lib/orders/access";
import { reserveOrderBeat, cancelOrderReservation } from "@/lib/orders/reservations";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderActor(request, true);
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  try { const until = await prisma.$transaction((tx) => reserveOrderBeat(tx, orderId, guard.actor)); return NextResponse.json({ expiresAt: until.toISOString() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return orderError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderActor(request, true);
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  try { await prisma.$transaction((tx) => cancelOrderReservation(tx, orderId, guard.actor)); return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return orderError(error); }
}
