import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLoyaltyStatus } from "@/lib/loyalty";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPublicSessionState();

  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json(getLoyaltyStatus(0), { headers: { "Cache-Control": "private, no-store" } });
  }

  const row = await prisma.loyaltyPoint.findUnique({
    where: { userId: session.userId },
    select: { points: true },
  });

  const points = row?.points ?? 0;
  return NextResponse.json(getLoyaltyStatus(points), { headers: { "Cache-Control": "private, no-store" } });
}
