import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrderActor } from "@/lib/orders/access";
import { prisma } from "@/lib/db/client";
import { retrieveStripeCheckoutSession } from "@/lib/payments/stripe";
import { processBeatStripeSession } from "@/lib/payments/beat-stripe-webhook";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderActor(request, true); if (!guard.ok) return guard.response;
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  const order = await prisma.order.findFirst({ where: { id: orderId, ...(guard.actor.role === "buyer" ? { buyerUserId: guard.actor.userId } : {}) }, select: { provider: true, status: true, paymentExternalId: true } });
  if (!order) return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
  if (order.provider !== "stripe" || order.status === "paid") return NextResponse.json({ status: order.status }, { headers: { "Cache-Control": "no-store" } });
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !order.paymentExternalId) return NextResponse.json({ error: "Платёж ещё создаётся. Повторите проверку позже." }, { status: 409 });
  try {
    const session = await retrieveStripeCheckoutSession(key, order.paymentExternalId);
    if (session.payment_status === "paid") return processBeatStripeSession("checkout.session.completed", session);
    if (session.status === "expired") return processBeatStripeSession("checkout.session.expired", session);
    return NextResponse.json({ status: order.status }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Не удалось проверить платёж в Stripe. Повторите позже." }, { status: 503 }); }
}
