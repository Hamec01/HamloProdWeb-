import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSessionState } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrderForPreview,
  getContractSnapshotForPreview,
  renderContractHtml,
  saveContractSnapshot,
} from "@/lib/contracts/service";

// ---------------------------------------------------------------------------
// i18n copy
// ---------------------------------------------------------------------------

const copy = {
  ru: {
    eyebrow: "Предварительный просмотр договора",
    title: "Договор лицензии",
    orderSummary: "Сводка заказа",
    beat: "Бит",
    license: "Лицензия",
    total: "Итого",
    free: "Бесплатно",
    status: "Статус",
    back: "Назад к форме",
    proceed: "Перейти к оплате",
    noSupabase: "Supabase не подключён.",
    noContract: "Договор не найден. Попробуйте оформить заказ заново.",
    draft: "Черновик",
    note: "Ознакомьтесь с текстом договора. После нажатия «Перейти к оплате» договор будет зафиксирован.",
  },
  en: {
    eyebrow: "Contract Preview",
    title: "License Agreement",
    orderSummary: "Order Summary",
    beat: "Beat",
    license: "License",
    total: "Total",
    free: "Free",
    status: "Status",
    back: "Back to Form",
    proceed: "Proceed to Payment",
    noSupabase: "Supabase is not configured.",
    noContract: "Contract not found. Please submit the checkout form again.",
    draft: "Draft",
    note: "Review the license agreement below. Clicking \u201cProceed to Payment\u201d will lock the contract.",
  },
};

function formatUsd(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ContractPreviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);
  const t = copy[locale as "ru" | "en"] ?? copy.ru;

  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent(`/checkout/preview/${orderId}`)}`);
  }

  if (!hasSupabaseEnv()) {
    return (
      <section className="space-y-8">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} />
        <p className="text-sm text-[var(--color-paper-300)]">{t.noSupabase}</p>
      </section>
    );
  }

  // Load order (verifies ownership)
  const order = await getOrderForPreview(orderId, session.userId);
  if (!order) notFound();

  // Load beat info
  const supabase = await createSupabaseServerClient();
  const { data: beat } = await supabase
    .from("beats")
    .select("id, title, slug, case_number")
    .eq("id", order.beat_id)
    .maybeSingle<{ id: string; title: string; slug: string; case_number: string }>();

  if (!beat) notFound();

  // Load contract snapshot; regenerate if missing
  let snapshot = await getContractSnapshotForPreview(orderId);
  if (!snapshot) {
    const html = renderContractHtml(order, beat);
    const contractId = await saveContractSnapshot(order, beat, html);
    if (contractId) {
      snapshot = { contractId, htmlSnapshot: html };
    }
  }

  if (!snapshot) {
    return (
      <section className="space-y-8">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} />
        <p className="text-sm text-[var(--color-paper-300)]">{t.noContract}</p>
        <Link
          href={`/beats/${beat.slug}`}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {t.back}
        </Link>
      </section>
    );
  }

  const ORDER_STATUS_LABELS: Record<string, Record<string, string>> = {
    ru: {
      draft: "Черновик",
      pending_payment: "Ожидает оплаты",
      paid: "Оплачен",
      cancelled: "Отменён",
      failed: "Ошибка",
      refunded: "Возврат",
    },
    en: {
      draft: "Draft",
      pending_payment: "Pending Payment",
      paid: "Paid",
      cancelled: "Cancelled",
      failed: "Failed",
      refunded: "Refunded",
    },
  };

  const statusLabel =
    ORDER_STATUS_LABELS[locale as string]?.[order.status] ??
    ORDER_STATUS_LABELS.en[order.status] ??
    order.status;

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/beats/${beat.slug}`}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {t.back}
        </Link>
      </div>

      <SectionHeading eyebrow={t.eyebrow} title={t.title} />

      <div className="mx-auto max-w-4xl space-y-6">
        {/* Order summary */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
          <p className="mb-4 text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">
            {t.orderSummary}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.beat}</p>
              <p className="mt-1 text-sm text-[var(--color-paper-100)]">
                CASE #{beat.case_number}
              </p>
              <p className="text-xs text-[var(--color-paper-300)]">{beat.title}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.license}</p>
              <p className="mt-1 text-sm uppercase tracking-[0.1em] text-[var(--color-paper-100)]">
                {order.license_type}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.total}</p>
              <p className="mt-1 text-sm text-[var(--color-paper-100)]">
                {order.final_price_usd === 0 ? t.free : formatUsd(order.final_price_usd, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">{t.status}</p>
              <p className="mt-1 text-sm uppercase tracking-[0.1em] text-amber-400">
                {statusLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Notice */}
        <p className="text-xs text-[var(--color-paper-400)] leading-relaxed">
          {t.note}
        </p>

        {/* Contract document */}
        <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-xl">
          <ContractIframe html={snapshot.htmlSnapshot} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href={`/beats/${beat.slug}`}
            className="inline-flex items-center gap-2 border border-[var(--color-line)] px-6 py-3 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            <ArrowLeft size={14} />
            {t.back}
          </Link>

          {/* TODO: replace with actual Lava payment API call in next phase */}
          <button
            type="button"
            disabled
            title="Payment integration coming soon"
            className="inline-flex cursor-not-allowed items-center gap-2 border border-[var(--color-line)] px-6 py-3 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] opacity-50"
          >
            <CreditCard size={14} />
            {t.proceed}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ContractIframe — renders the contract HTML safely via a sandboxed iframe
// ---------------------------------------------------------------------------

function ContractIframe({ html }: { html: string }) {
  // The HTML is stored server-side and generated by our own template functions;
  // it is never sourced from untrusted user input.
  // sandbox="allow-same-origin" allows the iframe to read its own origin's
  // storage/cookies while still blocking scripts and form submissions, which
  // is the correct level of isolation for a read-only document display.
  const encoded = Buffer.from(html, "utf-8").toString("base64");

  return (
    <iframe
      title="License Agreement"
      className="h-[900px] w-full border-0"
      srcDoc={html}
      sandbox="allow-same-origin"
      loading="lazy"
      // base64 data URI as a fallback for environments where srcDoc is not
      // rendered (e.g. certain email clients / PDF renderers in a later phase)
      data-contract-b64={encoded}
    />
  );
}
