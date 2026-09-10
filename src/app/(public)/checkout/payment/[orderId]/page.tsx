import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PaymentCreatePanel } from "@/components/checkout/payment-create-panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLocale } from "@/lib/i18n-server";
import { getOrderForPayment } from "@/lib/payments/create";
import { formatMarketMoney } from "@/lib/market";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";

export default async function CheckoutPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { orderId } = await params;
  const { start } = await searchParams;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);


  if (!session.isAuthenticated) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/payment/${orderId}`)}`);
  }

  let paymentData: Awaited<ReturnType<typeof getOrderForPayment>>;
  try {
    paymentData = await getOrderForPayment(orderId);
  } catch {
    notFound();
  }

  const { order, beat, contractSnapshotExists } = paymentData;
  const currency = resolveOrderCurrency(order);
  const basePrice = resolveOrderBasePrice(order);
  const finalPrice = resolveOrderFinalPrice(order);
  const autoStart = start === "1" && order.status === "draft";

  return (
    <section className="space-y-8">
      <Link
        href={`/checkout/preview/${orderId}`}
        className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      >
        <ArrowLeft size={14} />
        {locale === "ru" ? "Назад к договору" : "Back to Contract"}
      </Link>

      <SectionHeading
        eyebrow={locale === "ru" ? "Оплата" : "Payment"}
        title={locale === "ru" ? "Проверка заказа перед созданием платежа" : "Review Order Before Creating Payment"}
        description={
          locale === "ru"
            ? "Платёж создаётся только на сервере: заказ и snapshot договора проверяются до запроса в Lava."
            : "Payment is created server-side only: the order and contract snapshot are validated before any Lava request."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">
            {locale === "ru" ? "Сводка заказа" : "Order Summary"}
          </p>
          <div className="mt-4 space-y-3 text-sm text-[var(--color-paper-200)]">
            <p><span className="text-[var(--color-paper-400)]">Beat:</span> {beat.title}</p>
            <p><span className="text-[var(--color-paper-400)]">Email:</span> {order.buyer_email}</p>
            <p><span className="text-[var(--color-paper-400)]">Transfer:</span> {locale === "ru" ? "Полное отчуждение прав" : "Full rights transfer"}</p>
            <p><span className="text-[var(--color-paper-400)]">Base:</span> {formatMarketMoney(basePrice, currency, locale as "ru" | "en")}</p>
            <p><span className="text-[var(--color-paper-400)]">Discount:</span> {order.discount_percent}%</p>
            <p><span className="text-[var(--color-paper-400)]">Final:</span> {formatMarketMoney(finalPrice, currency, locale as "ru" | "en")}</p>
            <p><span className="text-[var(--color-paper-400)]">Currency:</span> {currency}</p>
            <p><span className="text-[var(--color-paper-400)]">Status:</span> {order.status}</p>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">
            {locale === "ru" ? "Состояние договора" : "Contract State"}
          </p>
          <div className="mt-4 space-y-3 text-sm text-[var(--color-paper-200)]">
            <p>
              {contractSnapshotExists
                ? locale === "ru"
                  ? "Snapshot договора найден и готов к использованию для оплаты и будущего PDF."
                  : "The contract snapshot exists and is ready for payment and future PDF generation."
                : locale === "ru"
                  ? "Snapshot договора отсутствует. Платёжный шаг будет отклонён сервером до исправления."
                  : "The contract snapshot is missing. The payment step will be rejected by the server until fixed."}
            </p>
          </div>
        </article>
      </div>

      <PaymentCreatePanel orderId={orderId} locale={locale as "ru" | "en"} autoStart={autoStart} />
    </section>
  );
}
