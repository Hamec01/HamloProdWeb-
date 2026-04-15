import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getPublicSessionState } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n-server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  renderContractHtml,
  buildContractNumber,
  formatContractDate,
  type ContractLanguage,
} from "@/lib/contracts/templates";

type ContractRow = {
  html_snapshot: string;
  orders: {
    id: string;
    beat_id: string;
    buyer_user_id: string;
    buyer_name: string | null;
    buyer_email: string;
    buyer_country: string | null;
    buyer_city: string | null;
    buyer_phone: string | null;
    license_type: string;
    contract_language: string;
    base_price_usd: number;
    discount_percent: number;
    final_price_usd: number;
    created_at: string;
    beats: { title: string; slug: string } | null;
  } | null;
};

export default async function ContractPreviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);

  if (!session.isAuthenticated || !session.userId) {
    redirect("/auth?next=/checkout/preview/" + orderId);
  }

  if (!hasSupabaseEnv()) notFound();

  const supabase = await createSupabaseServerClient();

  let contractRow = await supabase
    .from("contracts")
    .select(
      "html_snapshot, orders(id, beat_id, buyer_user_id, buyer_name, buyer_email, " +
      "buyer_country, buyer_city, buyer_phone, license_type, contract_language, " +
      "base_price_usd, discount_percent, final_price_usd, created_at, beats(title, slug))",
    )
    .eq("order_id", orderId)
    .maybeSingle<ContractRow>();

  // If snapshot missing — regenerate from order
  if (!contractRow.data) {
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, beat_id, buyer_user_id, buyer_name, buyer_email, buyer_country, buyer_city, " +
        "buyer_phone, license_type, contract_language, base_price_usd, discount_percent, " +
        "final_price_usd, created_at, beats(title, slug)",
      )
      .eq("id", orderId)
      .maybeSingle<ContractRow["orders"]>();

    if (!order) notFound();
    if (order.buyer_user_id !== session.userId) notFound();

    const lang = (["ru", "en", "bilingual"].includes(order.contract_language)
      ? order.contract_language
      : "ru") as ContractLanguage;
    const createdAt = new Date(order.created_at);

    const licenseLabel =
      order.license_type === "exclusive"
        ? lang === "en" ? "Exclusive License" : "Эксклюзивная лицензия"
        : lang === "en" ? "Basic (Non-Exclusive) License" : "Базовая (неисключительная) лицензия";

    const html = renderContractHtml(lang, {
      contract_number: buildContractNumber(order.id, createdAt),
      current_date: formatContractDate(createdAt, lang),
      beat_title: order.beats?.title ?? order.beat_id,
      license_type: licenseLabel,
      buyer_name: order.buyer_name ?? "—",
      buyer_email: order.buyer_email,
      buyer_country: order.buyer_country ?? "—",
      buyer_city: order.buyer_city ?? "—",
      buyer_phone: order.buyer_phone ?? "—",
      amount: String(order.final_price_usd),
      currency: "USD",
      seller_name: process.env.NEXT_PUBLIC_SELLER_NAME ?? "HamloProd",
      seller_country: process.env.NEXT_PUBLIC_SELLER_COUNTRY ?? "",
      seller_city: process.env.NEXT_PUBLIC_SELLER_CITY ?? "",
    });

    await supabase.from("contracts").upsert(
      { order_id: order.id, beat_id: order.beat_id, buyer_email: order.buyer_email, html_snapshot: html },
      { onConflict: "order_id" },
    );

    contractRow = {
      data: { html_snapshot: html, orders: order },
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    };
  }

  const row = contractRow.data!;
  if (row.orders?.buyer_user_id !== session.userId) notFound();

  const order = row.orders!;
  const beatSlug = order.beats?.slug ?? "";

  const isRu = locale === "ru";
  const labels = {
    back: isRu ? "Изменить данные" : "Edit Order",
    pay: isRu ? "Перейти к оплате" : "Proceed to Payment",
    title: isRu ? "Предпросмотр договора" : "Contract Preview",
    hint: isRu
      ? "Ознакомьтесь с договором. После оплаты он будет доступен в профиле для скачивания PDF."
      : "Review the contract. After payment it will be available in your profile as a PDF download.",
    summary: isRu ? "Сводка заказа" : "Order Summary",
    beat: isRu ? "Бит" : "Beat",
    license: isRu ? "Лицензия" : "License",
    amount: isRu ? "Сумма" : "Amount",
    discount: isRu ? "Скидка" : "Discount",
    total: isRu ? "Итого" : "Total",
  };

  function fUsd(v: number) {
    return new Intl.NumberFormat(isRu ? "ru-RU" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  }

  return (
    <section className="space-y-8">
      {/* Top nav */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={"/checkout/" + beatSlug}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {labels.back}
        </Link>

        <Link
          href={"/checkout/pay/" + orderId}
          className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.55)] bg-[rgba(185,149,90,0.14)] px-6 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.24)]"
        >
          {labels.pay}
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Heading + hint */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{labels.title}</p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-paper-300)]">{labels.hint}</p>
      </div>

      {/* Order summary strip */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-5">
        <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-[var(--color-paper-400)]">{labels.summary}</p>
        <div className="flex flex-wrap gap-6 text-sm text-[var(--color-paper-200)]">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{labels.beat}</span>
            <span className="text-[var(--color-paper-100)]">{order.beats?.title ?? "—"}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{labels.license}</span>
            <span className="text-[var(--color-paper-100)] capitalize">{order.license_type}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{labels.amount}</span>
            <span>{fUsd(order.base_price_usd)}</span>
          </div>
          {order.discount_percent > 0 && (
            <div>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{labels.discount}</span>
              <span className="text-amber-400">−{order.discount_percent}%</span>
            </div>
          )}
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper-400)]">{labels.total}</span>
            <span className="font-semibold text-[var(--color-paper-100)]">
              {order.final_price_usd === 0 ? (isRu ? "Бесплатно" : "Free") : fUsd(order.final_price_usd)}
            </span>
          </div>
        </div>
      </div>

      {/* Contract document rendered in a white iframe-like box */}
      <div
        className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-lg"
        style={{ minHeight: "600px" }}
      >
        <iframe
          srcDoc={row.html_snapshot}
          title="Contract Preview"
          className="h-full w-full"
          style={{ minHeight: "700px", border: "none" }}
          sandbox="allow-same-origin"
        />
      </div>

      {/* Bottom actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <Link
          href={"/checkout/" + beatSlug}
          className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <ArrowLeft size={14} />
          {labels.back}
        </Link>
        <Link
          href={"/checkout/pay/" + orderId}
          className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.55)] bg-[rgba(185,149,90,0.14)] px-6 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)] transition-colors hover:bg-[rgba(185,149,90,0.24)]"
        >
          {labels.pay}
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
