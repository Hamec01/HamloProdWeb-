import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

type BeatRow = {
  id: string;
  title: string;
  slug: string;
  case_number: string;
  price_usd: number;
  status: string;
};

type LoyaltyRow = { points: number };

function calcDiscount(points: number) {
  if (points >= 4) return 100;
  if (points >= 2) return 50;
  return 0;
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  // Must be logged in
  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  }

  if (!hasSupabaseEnv()) {
    return (
      <section className="space-y-8">
        <SectionHeading eyebrow="Checkout" title="Оформление заказа" />
        <p className="text-sm text-[var(--color-paper-300)]">
          Supabase не подключён.
        </p>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: beat } = await supabase
    .from("beats")
    .select("id, title, slug, case_number, price_usd, status")
    .eq("slug", slug)
    .maybeSingle<BeatRow>();

  if (!beat) notFound();

  if (beat.status === "sold" || beat.status === "private") {
    redirect(`/beats/${slug}`);
  }

  // Loyalty points → discount
  const { data: loyalty } = await supabase
    .from("user_loyalty_points")
    .select("points")
    .eq("user_id", session.userId)
    .maybeSingle<LoyaltyRow>();

  const points = loyalty?.points ?? 0;
  const discountPercent = calcDiscount(points);
  const finalPriceUsd = Math.max(0, Math.round((beat.price_usd * (100 - discountPercent)) / 100));

  const heading = locale === "ru" ? "Оформление заказа" : "Checkout";
  const eyebrow = locale === "ru" ? "Покупка лицензии" : "License Purchase";
  const backLabel = locale === "ru" ? "Назад к биту" : "Back to Beat";

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/beats/${slug}`}
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
          beatCaseNumber={beat.case_number}
          basePriceUsd={beat.price_usd}
          discountPercent={discountPercent}
          finalPriceUsd={finalPriceUsd}
          prefillEmail={session.email ?? ""}
          locale={locale as Locale}
        />
      </div>
    </section>
  );
}
