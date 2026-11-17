import { awardSalePoints } from "@/lib/loyalty/award-sale";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import { renderExclusiveLicenseBilingual } from "@/lib/contracts/templates/exclusive-license-bilingual";
import { formatMarketMoney } from "@/lib/market";
import { lockBeatForExclusiveSale } from "@/lib/orders/exclusive-sale";
import type { AdminLicenseCreateInput } from "@/lib/validations/admin-license";

function getContractNumber(orderId: string) {
  return `HP-${orderId.toUpperCase()}`;
}

export async function createManualExclusiveLicense(input: AdminLicenseCreateInput) {
  const seller = await getSellerIdentity();
  const orderId = randomUUID();
  const acceptedAt = new Date();
  const currencyLocale = input.currency === "RUB" ? "ru" : "en";
  const dateRu = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(acceptedAt);
  const dateEn = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", year: "numeric" }).format(acceptedAt);

  const beat = await prisma.beat.findUnique({
    where: { id: input.beatId },
    select: { id: true, slug: true, title: true, caseNumber: true, status: true },
  });
  if (!beat) throw new Error("BEAT_NOT_FOUND");
  if (beat.status !== "available" && beat.status !== "reserved") throw new Error("BEAT_NOT_AVAILABLE");

  const buyer = await prisma.user.findFirst({ where: input.buyerUserId ? { id: input.buyerUserId } : { email: { equals: input.buyerEmail, mode: "insensitive" } }, select: { id: true, email: true } });
  if (input.buyerUserId && !buyer) throw new Error("BUYER_NOT_FOUND");
  if (input.buyerUserId && buyer?.email.toLowerCase() !== input.buyerEmail.toLowerCase()) throw new Error("BUYER_EMAIL_MISMATCH");

  const contractHtml = renderExclusiveLicenseBilingual({
    contract_number: getContractNumber(orderId),
    date_ru: dateRu,
    date_en: dateEn,
    beat_title: beat.title,
    beat_catalog_number: beat.caseNumber,
    canonical_beat_id: beat.id,
    payment_method: "Ручная продажа / Manual sale",
    price: formatMarketMoney(input.amount, input.currency, currencyLocale),
    currency: input.currency,
    ...seller,
    mode: "partial",
    buyer_full_name: input.buyerName,
    buyer_city: input.buyerCity,
    buyer_country: input.buyerCountry,
    buyer_email: input.buyerEmail,
    buyer_stage_name: input.buyerStageName,
    buyer_acceptance_at: acceptedAt.toISOString(),
  });

  try {
    await prisma.$transaction(async (tx) => {
      if (!await lockBeatForExclusiveSale(tx, beat.id)) throw new Error("BEAT_NOT_AVAILABLE");

      await tx.order.create({
        data: {
          id: orderId,
          beatId: beat.id,
          buyerEmail: input.buyerEmail,
          buyerUserId: buyer?.id,
          buyerName: input.buyerName,
          buyerFullName: input.buyerName,
          buyerCountry: input.buyerCountry,
          buyerCity: input.buyerCity,
          buyerPhone: input.buyerPhone || null,
          buyerStageName: input.buyerStageName,
          basePriceUsd: input.currency === "USD" ? input.amount : 0,
          finalPriceUsd: input.currency === "USD" ? input.amount : 0,
          basePrice: input.amount,
          finalPrice: input.amount,
          currency: input.currency,
          market: input.currency === "RUB" ? "ru" : "global",
          provider: "contact",
          paymentProvider: "contact",
          paymentExternalId: `manual-${orderId}`,
          status: "paid",
          licenseType: "exclusive",
          contractLanguage: input.contractLanguage,
          termsAcceptedAt: acceptedAt,
          personalDataConsentAt: acceptedAt,
          rightsFormStatus: "completed_partial",
          contractTemplateType: "manual_bilingual",
          contractPdfKey: null,
          paidAt: acceptedAt,
        },
      });

      await tx.contract.create({
        data: {
          orderId,
          beatId: beat.id,
          buyerEmail: input.buyerEmail,
          htmlSnapshot: contractHtml,
        },
      });
      await awardSalePoints(tx, orderId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BEAT_NOT_AVAILABLE") throw error;
    console.error("[admin:licenses] manual sale transaction failed", {
      orderId,
      beatId: beat.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("MANUAL_LICENSE_CREATE_FAILED");
  }

  try {
    const pdf = await ensureOrderLicense(orderId);
    return { orderId, beatId: beat.id, beatSlug: beat.slug, beatTitle: beat.title, downloadUrl: pdf.downloadUrl, pdfReady: true, buyerLinked: Boolean(buyer) };
  } catch (error) {
    console.error("[admin:licenses] sale saved but PDF generation failed", {
      orderId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return { orderId, beatId: beat.id, beatSlug: beat.slug, beatTitle: beat.title, downloadUrl: null, pdfReady: false, buyerLinked: Boolean(buyer) };
  }
}
