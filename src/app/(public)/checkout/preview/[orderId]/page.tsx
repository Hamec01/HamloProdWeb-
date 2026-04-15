import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import {
  generateAndSaveContractSnapshot,
  getContractByOrderId,
  getOrderForPreview,
} from "@/lib/contracts/preview";
import { getLocale } from "@/lib/i18n-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

function formatUsd(value: number, locale: "ru" | "en") {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ContractPreviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const locale = (await getLocale()) as "ru" | "en";

  if (!hasSupabaseEnv()) {
    return (
      <section className="space-y-6">
        <SectionHeading eyebrow="Contract" title={locale === "ru" ? "Превью договора" : "Contract Preview"} />
        <p className="text-sm text-[var(--color-paper-300)]">
          Supabase не подключен.
        </p>
      </section>
    );
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/preview/${orderId}`)}`);
  }

  try {
    const [{ order, beat }, contract] = await Promise.all([
      getOrderForPreview(orderId),
      getContractByOrderId(orderId),
    ]);

    let snapshotHtml = contract?.html_snapshot?.trim() ?? "";

    if (!snapshotHtml || snapshotHtml.includes("placeholder")) {
      const regenerated = await generateAndSaveContractSnapshot(orderId);
      snapshotHtml = regenerated.contract.html_snapshot;
    }

    return (
      <section className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/checkout/${beat.slug}`}
            className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            <ArrowLeft size={14} />
            {locale === "ru" ? "Назад к форме" : "Back to Edit"}
          </Link>

          <Link
            href={`/checkout/payment/${order.id}?start=1`}
            className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.2)]"
          >
            {locale === "ru" ? "Перейти к оплате" : "Proceed to Payment"}
            <ArrowRight size={14} />
          </Link>
        </div>

        <SectionHeading
          eyebrow={locale === "ru" ? "Договор" : "Contract"}
          title={locale === "ru" ? "Проверьте договор перед оплатой" : "Review Contract Before Payment"}
          description={locale === "ru" ? "Это сохраненный серверный snapshot из таблицы contracts." : "This is a saved server-side snapshot from the contracts table."}
        />

        <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">
            {locale === "ru" ? "Сводка заказа" : "Order Summary"}
          </p>
          <div className="mt-4 grid gap-4 text-sm text-[var(--color-paper-200)] sm:grid-cols-2">
            <p>
              <span className="text-[var(--color-paper-400)]">ID:</span> {order.id}
            </p>
            <p>
              <span className="text-[var(--color-paper-400)]">Beat:</span> {beat.title}
            </p>
            <p>
              <span className="text-[var(--color-paper-400)]">License:</span> {order.license_type}
            </p>
            <p>
              <span className="text-[var(--color-paper-400)]">Total:</span> {formatUsd(order.final_price_usd, locale)}
            </p>
            <p>
              <span className="text-[var(--color-paper-400)]">Email:</span> {order.buyer_email}
            </p>
            <p>
              <span className="text-[var(--color-paper-400)]">Status:</span> {order.status}
            </p>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[rgba(12,10,8,0.88)] p-2 sm:p-4">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-100)]">
            <div dangerouslySetInnerHTML={{ __html: snapshotHtml }} />
          </div>
        </article>
      </section>
    );
  } catch {
    notFound();
  }
}
