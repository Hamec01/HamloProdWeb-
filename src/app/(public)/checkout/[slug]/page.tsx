import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/public-session";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getDiscountPercent } from "@/lib/loyalty";
import { getMarketContext } from "@/lib/market";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBeatBySlug } from "@/services/content";

type LoyaltyRow = { points: number };

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

  if (!hasSupabaseEnv()) {
    return (
      <section className="space-y-8">
        <SectionHeading eyebrow="Checkout" title="Оформление заказа" />
        <p className="text-sm text-[var(--color-paper-300)]">Supabase не подключён.</p>
      </section>
    );
  }

  const [supabase, beat] = await Promise.all([createSupabaseServerClient(), getBeatBySlug(slug)]);

  console.info("[checkout] beat lookup result", {
    slug,
    query: "getBeatBySlug -> getBeats -> beats where status != private",
    found: Boolean(beat),
    beatId: beat?.id ?? null,
    beatSlug: beat?.slug ?? null,
    beatStatus: beat?.status ?? null,
  });

  if (!beat) {
    console.warn("[checkout] notFound triggered", {
      slug,
      branch: "beat_not_found_after_shared_lookup",
    });
    notFound();
  }

  if (beat.status === "sold" || beat.status === "private") {
    redirect(`/${locale}/beats/${slug}`);
  }

  const market = getMarketContext(locale as Locale);
  const basePrice = locale === "ru" ? (beat.priceRub ?? 2500) : beat.priceUsd;

  const { data: loyalty } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", session.userId)
    .maybeSingle<LoyaltyRow>();

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
