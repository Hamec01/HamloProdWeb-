import { prisma } from "@/lib/db/client";
import { checkBeatForBuyer, reserveOrderBeat, systemMessage, type OrderActor } from "@/lib/orders/reservations";

export async function createBeatInquiry(beatId: string, buyer: { userId: string; email: string }, locale: "ru" | "en", reserve: boolean) {
  return prisma.$transaction(async (tx) => {
    const beat = await checkBeatForBuyer(tx, beatId, buyer.userId);
    let order = await tx.order.findFirst({ where: { beatId, buyerUserId: buyer.userId, provider: "contact", status: "draft" }, orderBy: { createdAt: "desc" } });
    if (!order) {
      const amount = locale === "ru" ? beat.priceRub ?? 2500 : beat.priceUsd;
      order = await tx.order.create({ data: { beatId, buyerUserId: buyer.userId, buyerEmail: buyer.email, basePriceUsd: locale === "en" ? amount : 0, finalPriceUsd: locale === "en" ? amount : 0, basePrice: amount, finalPrice: amount, currency: locale === "ru" ? "RUB" : "USD", market: locale === "ru" ? "ru" : "global", provider: "contact", paymentProvider: "contact", licenseType: "exclusive", contractLanguage: locale } });
      await systemMessage(tx, order.id, "Заявка на покупку бита создана. Здесь можно обсудить оплату с продавцом и оформить бронь на 7 дней.");
    }
    const actor: OrderActor = { userId: buyer.userId, role: "buyer" };
    if (reserve) await reserveOrderBeat(tx, order.id, actor);
    return { orderId: order.id, url: `/orders/${order.id}` };
  });
}
