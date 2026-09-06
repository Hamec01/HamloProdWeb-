import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RightsFormPanel } from "@/components/checkout/rights-form-panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLocale } from "@/lib/i18n-server";
import { getOrderForPayment } from "@/lib/payments/create";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function CheckoutRightsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  if (!hasSupabaseEnv()) {
    return (
      <section className="space-y-6">
        <SectionHeading eyebrow="Rights" title={locale === "ru" ? "Форма передачи прав" : "Rights Form"} />
        <p className="text-sm text-[var(--color-paper-300)]">Supabase не подключен.</p>
      </section>
    );
  }

  if (!session.isAuthenticated) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/rights/${orderId}`)}`);
  }

  let paymentData: Awaited<ReturnType<typeof getOrderForPayment>>;
  try {
    paymentData = await getOrderForPayment(orderId);
  } catch {
    notFound();
  }

  const { order, beat } = paymentData;
  const paidOrFree = order.status === "paid" || order.status === "pending_free_checkout";

  return (
    <section className="space-y-8">
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      >
        <ArrowLeft size={14} />
        {locale === "ru" ? "Назад в профиль" : "Back to Profile"}
      </Link>

      <SectionHeading
        eyebrow={locale === "ru" ? "Права" : "Rights"}
        title={locale === "ru" ? "Передача прав по заказу" : "Rights Transfer for Order"}
        description={
          locale === "ru"
            ? `Бит: ${beat.title}. Выберите: заполнить форму сейчас или сформировать шаблон и заполнить позже.`
            : `Beat: ${beat.title}. Choose to fill now or generate a template and fill later.`
        }
      />

      {!paidOrFree ? (
        <article className="rounded-2xl border border-amber-500/30 bg-amber-900/15 p-6 text-sm text-amber-200">
          {locale === "ru"
            ? "Оплата еще не подтверждена webhook-событием. Статус заказа должен стать paid (или pending_free_checkout для бесплатного кейса)."
            : "Payment is not confirmed by webhook yet. Order status must become paid (or pending_free_checkout for free case)."}
        </article>
      ) : (
        <RightsFormPanel
          orderId={order.id}
          locale={locale as "ru" | "en"}
          defaultFullName={order.buyer_name ?? ""}
          defaultCity={order.buyer_city ?? ""}
          defaultStageName={""}
        />
      )}
    </section>
  );
}
