import { z } from "zod";
import { NextResponse } from "next/server";
import { requireBuyer } from "@/lib/auth/public-guard";
import { redeemBeatOrder } from "@/lib/loyalty/redeem-order";
import { orderError } from "@/lib/orders/access";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  try { return NextResponse.json(await redeemBeatOrder(orderId, guard.context.userId), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return orderError(error); }
}
