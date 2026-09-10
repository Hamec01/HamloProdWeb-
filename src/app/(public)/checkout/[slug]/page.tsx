import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { PaymentsDisabledNotice } from "@/components/checkout/payments-disabled-notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { isPaidCheckoutEnabled } from "@/lib/checkout/config";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getDiscountPercent } from "@/lib/loyalty";
import { getMarketContext } from "@/lib/market";
import { getBeatBySlug } from "@/services/content";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  console.info("[checkout] incoming request", {
    slug,
    locale,
    isAuthenticated: session.isAuthenticated,
    userId: session.userId ?? null,
  });

  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  }

  const beat = await getBeatBySlug(slug);

  if (!beat) {
    notFound();
  }

  if (!isPaidCheckoutEnabled()) {
    const eyebrow = locale === "ru" ? "Покупка прав" : "Rights Purchase";
    const heading = locale === "ru" ? "Оформление заказа" : "Checkout";
    return (
      <section className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/${locale}/beats/${slug}`}
            className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            <ArrowLeft size={14} />
            {locale === "ru" ? "Назад к биту" : "Back to Beat"}
          </Link>
        </div>
        <SectionHeading eyebrow={eyebrow} title={heading} />
        <div className="mx-auto max-w-2xl">
          <PaymentsDisabledNotice locale={locale} />
        </div>
      </section>
    );
  }

  if (beat.status === "sold" || beat.status === "private") {
    redirect(`/${locale}/beats/${slug}`);
  }

  const market = getMarketContext(locale as Locale);
  const basePrice = locale === "ru" ? (beat.priceRub ?? 2500) : beat.priceUsd;

  const loyalty = await prisma.loyaltyPoint.findUnique({
    where: { userId: session.userId },
    select: { points: true },
  });

  const points = loyalty?.points ?? 0;
  const discountPercent = getDiscountPercent(points);
  const finalPriceUsd = Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));

  const heading = locale === "ru" ? "Оформление заказа" : "Checkout";
  const eyebrow = locale === "ru" ? "Покупка прав" : "Rights Purchase";
  const backLabel = locale === "ru" ? "Назад к биту" : "Back to Beat";

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/${locale}/beats/${slug}`}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
      </div>

      <SectionHeading eyebrow={eyebrow} title={heading} />

      <div className="mx-auto max-w-2xl">
        <CheckoutForm
          beatId={beat.id}
          beatTitle={beat.title}
          beatCaseNumber={beat.caseNumber}
          basePriceUsd={basePrice}
          discountPercent={discountPercent}
          finalPriceUsd={finalPriceUsd}
          currency={market.currency}
          availablePoints={points}
          prefillEmail={session.email ?? ""}
          locale={locale as Locale}
        />
      </div>
    </section>
  );
}
