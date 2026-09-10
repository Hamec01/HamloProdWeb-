import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";
import { getDiscountPercent } from "@/lib/loyalty";

export const runtime = "nodejs";

/**
 * Loyalty "purchase" — records a free-tier acquisition and bumps the buyer's
 * point balance. The real paid flow is /api/checkout + /api/payments.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const beat = await prisma.beat.findUnique({
    where: { id },
    select: { id: true, title: true, priceUsd: true, status: true },
  });

  if (!beat) return NextResponse.json({ error: "Beat not found." }, { status: 404 });
  if (beat.status === "sold" || beat.status === "private") {
    return NextResponse.json({ error: "Beat is not available for purchase." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.loyaltyPoint.findUnique({ where: { userId: guard.context.userId }, select: { points: true } });
    const pointsBefore = current?.points ?? 0;
    const discountPercent = getDiscountPercent(pointsBefore);
    const finalPriceUsd = Math.max(0, Math.round((beat.priceUsd * (100 - discountPercent)) / 100));
    const pointsAfter = pointsBefore + 1;

    await tx.beatPurchase.create({
      data: {
        beatId: beat.id,
        beatTitle: beat.title,
        userId: guard.context.userId,
        userEmail: guard.context.email,
        basePriceUsd: beat.priceUsd,
        discountPercent,
        finalPriceUsd,
        pointsEarned: 1,
      },
    });

    await tx.loyaltyPoint.upsert({
      where: { userId: guard.context.userId },
      create: { userId: guard.context.userId, userEmail: guard.context.email, points: pointsAfter },
      update: { points: pointsAfter, userEmail: guard.context.email },
    });

    return { basePriceUsd: beat.priceUsd, finalPriceUsd, discountPercent, pointsBefore, pointsAfter, pointsEarned: 1 };
  });

  return NextResponse.json(result);
}
