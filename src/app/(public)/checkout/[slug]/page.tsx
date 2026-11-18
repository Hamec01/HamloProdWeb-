import { getBeatCheckoutProvider, isBeatStripeReady } from "@/lib/checkout/config";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLocale } from "@/lib/i18n-server";
import { getMarketContext } from "@/lib/market";
import { getDiscountPercent } from "@/lib/loyalty";
import { getBeatBySlug } from "@/services/content";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  console.info("[checkout] incoming request", {
    slug,
    locale,
    isAuthenticated: session.isAuthenticated,
    userId: session.userId ?? null,
  });

  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/${slug}${payment === "stripe" || payment === "contact" ? `?payment=${payment}` : ""}`)}`);
  }

  const beat = await getBeatBySlug(slug);

  if (!beat) {
    notFound();
  }

  if (beat.status === "sold" || beat.status === "private") {
    redirect(`/${locale}/beats/${slug}`);
  }

  let provider = payment === "stripe" ? "stripe" : payment === "contact" ? "contact" : getBeatCheckoutProvider(locale);
  if (provider === "stripe" && !isBeatStripeReady()) redirect(`/beats/${slug}`);
  if (provider === "stripe" && !await prisma.beat.findFirst({ where: { id: beat.id, OR: [{ archiveKey: { not: null } }, { delivery: { isNot: null } }] }, select: { id: true } })) {
    if (payment === "stripe") redirect(`/beats/${slug}`);
    provider = "contact";
  }
  const market = getMarketContext(provider === "stripe" ? "en" : locale);
  const basePrice = market.currency === "RUB" ? beat.priceRub ?? 2500 : beat.priceUsd;

  const [licenseProfile, loyalty] = await Promise.all([prisma.buyerLicenseProfile.findUnique({ where: { userId: session.userId } }), prisma.loyaltyPoint.findUnique({
    where: { userId: session.userId },
    select: { points: true },
  })
  ]);
  const points = loyalty?.points ?? 0;
  const discountPercent = getDiscountPercent(points);
  const finalPriceUsd = Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/beats/${slug}`}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {locale === "ru" ? "Назад к биту" : "Back to Beat"}
        </Link>
      </div>

      <SectionHeading eyebrow={locale === "ru" ? "Лицензия на бит" : "Beat License"} title={locale === "ru" ? "Данные покупателя" : "Buyer Details"} />

      <div className="mx-auto max-w-2xl">
        <CheckoutForm
          paymentMethod={provider}
          beatId={beat.id}
          beatTitle={beat.title}
          beatCaseNumber={beat.caseNumber}
          basePriceUsd={basePrice}
          discountPercent={discountPercent}
          finalPriceUsd={finalPriceUsd}
          currency={market.currency}
          availablePoints={points}
          prefillEmail={session.email ?? ""}
          profileDetails={licenseProfile ? { fullName: licenseProfile.fullName, stageName: licenseProfile.stageName, email: licenseProfile.email, country: licenseProfile.country, city: licenseProfile.city, phone: licenseProfile.phone } : undefined}
          locale={locale as "ru" | "en"}
        />
      </div>
    </section>
  );
}
