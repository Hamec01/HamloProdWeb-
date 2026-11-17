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
  if (order.provider === "contact") {
    return <section className="case-panel p-6 space-y-5">
      <SectionHeading eyebrow="HamloProd" title={locale === "ru" ? "Заявка на лицензию сохранена" : "License Request Saved"} description={locale === "ru" ? "Напишите в Telegram или VK и сообщите номер заказа. После подтверждения оплаты PDF появится в вашем профиле." : "Contact us via Telegram or VK and include your order number. Your license PDF will appear in your profile after payment is confirmed."} />
      <p>{beat.title}</p><p className="break-all text-sm">{locale === "ru" ? "Номер заказа" : "Order number"}: {order.id}</p>
      <div className="flex flex-wrap gap-4"><a className="underline" href="https://t.me/Andrei91S" target="_blank" rel="noreferrer">Telegram</a><a className="underline" href="https://vk.ru/hamloproduction" target="_blank" rel="noreferrer">VK</a><Link className="underline" href="/profile">{locale === "ru" ? "Мои покупки" : "My Purchases"}</Link></div>
    </section>;
  }
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
            ? "Платёж создаётся на сервере после проверки заказа и snapshot договора."
            : "Payment is created server-side after validating the order and contract snapshot."
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
            <p><span className="text-[var(--color-paper-400)]">License:</span> {locale === "ru" ? "Эксклюзивная лицензия, один покупатель" : "One-time exclusive license"}</p>
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
