import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";
import { isPaidCheckoutEnabled, paidCheckoutDisabledResponse } from "@/lib/checkout/config";
import { getLocale } from "@/lib/i18n-server";
import { getMarketContext } from "@/lib/market";
import { checkoutFormSchema } from "@/lib/validations/checkout";
import { getDiscountPercent } from "@/lib/loyalty";

export const runtime = "nodejs";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  // Paid checkout is off → never create or change an Order.
  if (!isPaidCheckoutEnabled()) {
    const d = paidCheckoutDisabledResponse();
    return NextResponse.json(d.body, { status: d.status });
  }

  const parsed = checkoutFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const {
    beat_id,
    buyer_name,
    buyer_email,
    buyer_country,
    buyer_city,
    buyer_phone,
    license_type,
    contract_language,
    use_loyalty_points,
  } = parsed.data;

  const locale = await getLocale();
  const market = getMarketContext(locale);

  const beat = await prisma.beat.findUnique({
    where: { id: beat_id },
    select: { id: true, priceUsd: true, priceRub: true, status: true },
  });
  if (!beat) return err("Beat not found.", 404);
  if (beat.status === "sold" || beat.status === "private") {
    return err("Beat is not available for purchase.", 409);
  }

  const loyalty = await prisma.loyaltyPoint.findUnique({
    where: { userId: guard.context.userId },
    select: { points: true },
  });
  const points = loyalty?.points ?? 0;
  const discountPercent = use_loyalty_points ? getDiscountPercent(points) : 0;

  const basePrice = market.currency === "RUB" ? beat.priceRub || 2500 : beat.priceUsd;
  const finalPrice = Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));

  const data = {
    beatId: beat_id,
    buyerUserId: guard.context.userId,
    buyerEmail: buyer_email,
    buyerName: buyer_name,
    buyerCountry: buyer_country,
    buyerCity: buyer_city,
    buyerPhone: buyer_phone,
    licenseType: license_type,
    contractLanguage: contract_language,
    basePrice,
    finalPrice,
    basePriceUsd: basePrice,
    finalPriceUsd: finalPrice,
    discountPercent,
    market: market.market,
    currency: market.currency,
    provider: market.paymentProvider,
    paymentProvider: market.paymentProvider,
    status: "draft" as const,
  };

  const existingDraft = await prisma.order.findFirst({
    where: { buyerUserId: guard.context.userId, beatId: beat_id, status: "draft" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existingDraft) {
    await prisma.order.update({ where: { id: existingDraft.id }, data });
    return NextResponse.json({ orderId: existingDraft.id }, { status: 200 });
  }

  const created = await prisma.order.create({ data, select: { id: true } });
  return NextResponse.json({ orderId: created.id }, { status: 201 });
}
