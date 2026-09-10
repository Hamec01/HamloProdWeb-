import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHeading } from "@/components/ui/section-heading";
import { prisma } from "@/lib/db/client";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { dictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatMarketMoney } from "@/lib/market";
import { resolveOrderBasePrice, resolveOrderCurrency, resolveOrderFinalPrice } from "@/lib/orders/pricing";
import { toOrderRow } from "@/lib/orders/order-row";

type BeatLookupRow = { id: string; title: string; slug: string; case_number: string };

function getDiscountPercent(points: number) {
  if (points >= 4) {
    return 100;
  }

  if (points >= 2) {
    return 50;
  }

  return 0;
}

function getNextThreshold(points: number) {
  if (points < 2) {
    return 2;
  }

  if (points < 4) {
    return 4;
  }

  return null;
}

function formatOrderMoney(value: number, currency: "USD" | "RUB", locale: string) {
  return formatMarketMoney(value, currency, locale === "ru" ? "ru" : "en");
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ProfilePage() {
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);
  const t = dictionary[locale];

  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent("/profile")}`);
  }

  const [loyaltyRow, orderRows, ratingRows] = await Promise.all([
    prisma.loyaltyPoint.findUnique({ where: { userId: session.userId }, select: { points: true } }),
    prisma.order.findMany({ where: { buyerUserId: session.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contentRating.findMany({
      where: { userId: session.userId, contentType: "beat" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { contentId: true, rating: true, createdAt: true },
    }),
  ]);

  const points = loyaltyRow?.points ?? 0;
  const discountPercent = getDiscountPercent(points);
  const nextThreshold = getNextThreshold(points);

  const orders = orderRows.map((o) => ({ ...toOrderRow(o), beat_id: o.beatId }));

  const beatIds = [...new Set([...orders.map((o) => o.beat_id), ...ratingRows.map((r) => r.contentId)])];
  const beatRows = beatIds.length
    ? await prisma.beat.findMany({ where: { id: { in: beatIds } }, select: { id: true, title: true, slug: true, caseNumber: true } })
    : [];
  const beatMap = new Map<string, BeatLookupRow>(
    beatRows.map((b) => [b.id, { id: b.id, title: b.title, slug: b.slug, case_number: b.caseNumber }]),
  );
  const orderBeatMap = beatMap;
  const ratedBeatMap = beatMap;

  return (
    <section className="space-y-10">
      <SectionHeading eyebrow={t.buyerAccount} title={t.profileTitle} description={t.profileDesc} />

      <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <h3 className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{t.profilePointsTitle}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{t.profileCurrentPoints}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">{points}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{t.profileCurrentDiscount}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">{discountPercent}%</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{t.profileNextDiscount}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">
              {nextThreshold ? nextThreshold : t.profileMaxDiscount}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <h3 className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{t.profilePurchasesTitle}</h3>
        <div className="mt-4 space-y-3">
          {orders.length === 0 ? <p className="text-sm text-[var(--color-paper-300)]">{t.profileNoPurchases}</p> : null}
          {orders.map((order) => {
            const beat = orderBeatMap.get(order.beat_id);
            const currency = resolveOrderCurrency(order);
            const basePrice = resolveOrderBasePrice(order);
            const finalPrice = resolveOrderFinalPrice(order);
            const statusColor = order.status === "paid" ? "text-green-400" : order.status === "cancelled" || order.status === "failed" ? "text-red-400" : "text-amber-400";
            return (
              <div key={order.id} className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {beat ? (
                      <Link href={`/beats/${beat.slug}`} className="text-sm uppercase tracking-[0.08em] text-[var(--color-paper-100)] hover:text-[var(--color-paper-50)]">
                        CASE #{beat.case_number} — {beat.title}
                      </Link>
                    ) : (
                      <p className="text-sm uppercase tracking-[0.08em] text-[var(--color-paper-100)]">{order.beat_id}</p>
                    )}
                    <p className={`mt-1 text-[10px] uppercase tracking-[0.22em] ${statusColor}`}>{order.status}</p>
                  </div>
                  <p className="text-xs text-[var(--color-paper-300)]">
                    {t.profilePurchasedAt}: {formatDate(order.created_at, locale)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-paper-300)]">
                  <span>{formatOrderMoney(basePrice, currency, locale)}</span>
                  {order.discount_percent > 0 && <span>−{order.discount_percent}%</span>}
                  <span className="text-[var(--color-paper-100)]">{finalPrice === 0 ? (locale === "ru" ? "Бесплатно" : "Free") : formatOrderMoney(finalPrice, currency, locale)}</span>
                  <span className="uppercase tracking-[0.1em]">{currency} / {locale === "ru" ? "отчуждение прав" : "rights transfer"}</span>
                  {(order.status === "paid" || order.status === "pending_free_checkout") && (
                    <Link
                      href={`/checkout/rights/${order.id}`}
                      className="uppercase tracking-[0.12em] text-[var(--color-paper-100)] underline decoration-dotted"
                    >
                      {locale === "ru"
                        ? order.rights_form_status === "not_started" || !order.rights_form_status
                          ? "Заполнить передачу прав"
                          : "Открыть форму передачи прав"
                        : order.rights_form_status === "not_started" || !order.rights_form_status
                          ? "Fill Rights Form"
                          : "Open Rights Form"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <h3 className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{t.profileRatingsTitle}</h3>
        <div className="mt-4 space-y-3">
          {ratingRows.length === 0 ? <p className="text-sm text-[var(--color-paper-300)]">{t.profileNoRatings}</p> : null}
          {ratingRows.map((row) => {
            const beat = ratedBeatMap.get(row.contentId);

            if (!beat) {
              return null;
            }

            const stars = "★".repeat(row.rating) + "☆".repeat(5 - row.rating);

            return (
              <div key={`${row.contentId}-${row.createdAt.toISOString()}`} className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm uppercase tracking-[0.08em] text-[var(--color-paper-100)]">
                    CASE #{beat.case_number} — {beat.title}
                  </p>
                  <p className="text-xs text-[var(--color-paper-300)]">
                    {t.profileRatedAt}: {formatDate(row.createdAt.toISOString(), locale)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-base tracking-widest text-amber-400">{stars}</span>
                  <Link
                    href={`/beats/${beat.slug}`}
                    className="text-xs uppercase tracking-[0.22em] text-[var(--color-paper-200)] transition-colors hover:text-[var(--color-paper-100)]"
                  >
                    {t.profileOpenBeat}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
