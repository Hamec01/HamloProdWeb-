import { NextRequest, NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { prisma } from "@/lib/db/client";
import { ensureOrderLicense } from "@/lib/contracts/issue";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { orderId } = await params;
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerUserId: session.userId }, select: { status: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!["paid", "pending_free_checkout"].includes(order.status)) return NextResponse.json({ error: "Payment is not confirmed." }, { status: 409 });
  try {
    const pdf = await ensureOrderLicense(orderId);
    return NextResponse.redirect(pdf.downloadUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "PDF пока недоступен. Повторите скачивание позже / Please retry the download later." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
