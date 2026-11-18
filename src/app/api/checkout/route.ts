import { checkBeatForBuyer } from "@/lib/orders/reservations";
import { orderError } from "@/lib/orders/access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireBuyer } from "@/lib/auth/public-guard";
import { getLocale } from "@/lib/i18n-server";
import { getMarketContext } from "@/lib/market";
import { isBeatStripeReady } from "@/lib/checkout/config";
import { checkoutFormSchema } from "@/lib/validations/checkout";
import { getDiscountPercent } from "@/lib/loyalty";
import { refreshExpiredStripeHold } from "@/lib/payments/stripe-checkout";

export const runtime = "nodejs";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const guard = await requireBuyer(request);
  if (!guard.ok) return guard.response;

  const parsed = checkoutFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const {
    beat_id,
    buyer_name,
    buyer_stage_name,
    buyer_email,
    buyer_country,
    buyer_city,
    buyer_phone,
    license_type,
    contract_language,
    use_loyalty_points,
  } = parsed.data;

  const locale = await getLocale();
  const provider = parsed.data.payment_method ?? "contact";
  if (provider === "stripe" && !isBeatStripeReady()) return err("Оплата Stripe пока недоступна.", 503);
  const market = getMarketContext(provider === "stripe" ? "en" : locale);

  const beat = await prisma.beat.findUnique({
    where: { id: beat_id },
    select: { id: true, priceUsd: true, priceRub: true, status: true, delivery: { select: { beatId: true } } },
  });
  if (!beat) return err("Beat not found.", 404);
  if (beat.status === "sold" || beat.status === "private") {
    return err("Beat is not available for purchase.", 409);
  }

  if (provider === "stripe" && (!beat.delivery || beat.priceUsd < 1)) return err("Для этого бита автоматическая оплата и выдача пока не настроены. Напишите продавцу.", 409);

  const loyalty = await prisma.loyaltyPoint.findUnique({
    where: { userId: guard.context.userId },
    select: { points: true },
  });
  const points = loyalty?.points ?? 0;
  const discountPercent = use_loyalty_points ? getDiscountPercent(points) : 0;

  const basePrice = market.currency === "RUB" ? beat.priceRub ?? 2500 : beat.priceUsd;
  const finalPrice = Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));

  const data = {
    beatId: beat_id,
    buyerUserId: guard.context.userId,
    buyerEmail: buyer_email,
    buyerName: buyer_name,
    buyerFullName: buyer_name,
    buyerStageName: buyer_stage_name || null,
    buyerCountry: buyer_country,
    buyerCity: buyer_city,
    buyerPhone: buyer_phone,
    licenseType: license_type,
    contractLanguage: contract_language,
    termsAcceptedAt: new Date(),
    personalDataConsentAt: new Date(),
    basePrice,
    finalPrice,
    basePriceUsd: market.currency === "USD" ? basePrice : 0,
    finalPriceUsd: market.currency === "USD" ? finalPrice : 0,
    discountPercent,
    market: market.market,
    currency: market.currency,
    provider: provider,
    paymentProvider: provider,
    status: "draft" as const,
  };

  try {
    await refreshExpiredStripeHold(beat_id);
    const orderId = await prisma.$transaction(async (tx) => {
      await checkBeatForBuyer(tx, beat_id, guard.context.userId);
      const existingDraft = await tx.order.findFirst({ where: { buyerUserId: guard.context.userId, beatId: beat_id, status: "draft" }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (existingDraft) {
        const updated = await tx.order.updateMany({ where: { id: existingDraft.id, status: "draft" }, data });
        if (!updated.count) throw new Error("ORDER_NOT_READY");
        await tx.contract.updateMany({ where: { orderId: existingDraft.id }, data: { htmlSnapshot: "<p>Contract draft placeholder.</p>", pdfKey: null } });
        return existingDraft.id;
      }
      return (await tx.order.create({ data, select: { id: true } })).id;
    });
    return NextResponse.json({ orderId }, { status: 201 });
  } catch (error) { return orderError(error); }

}
