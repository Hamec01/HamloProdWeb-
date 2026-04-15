import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";

export default async function CheckoutPaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  if (!session.isAuthenticated) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/payment/${orderId}`)}`);
  }

  return (
    <section className="space-y-6">
      <Link
        href={`/checkout/preview/${orderId}`}
        className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      >
        <ArrowLeft size={14} />
        {locale === "ru" ? "Назад к договору" : "Back to Contract"}
      </Link>

      <SectionHeading
        eyebrow={locale === "ru" ? "Оплата" : "Payment"}
        title={locale === "ru" ? "Интеграция оплаты будет следующим шагом" : "Payment Integration Is the Next Step"}
        description={
          locale === "ru"
            ? "TODO: здесь будет создание payment intent и редирект в Lava. Для заказов с 100% скидкой добавить отдельную backend-ветку, но сохранить тот же lifecycle статусов."
            : "TODO: this page will create a payment intent and redirect to Lava. Add a separate backend branch for 100%-discount orders while keeping the same order lifecycle states."
        }
      />
    </section>
  );
}
