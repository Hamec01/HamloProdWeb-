import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getDiscountPercent } from "@/lib/loyalty";

export const runtime = "nodejs";

export async function GET() {
  const session = await getPublicSessionState();

  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ points: 0, discountPercent: 0, nextThreshold: 2 });
  }

  const row = await prisma.loyaltyPoint.findUnique({
    where: { userId: session.userId },
    select: { points: true },
  });

  const points = row?.points ?? 0;
  const nextThreshold = points < 2 ? 2 : points < 4 ? 4 : null;
  return NextResponse.json({ points, discountPercent: getDiscountPercent(points), nextThreshold });
}
