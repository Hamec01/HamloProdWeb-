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

function formatOrderMoney(value: number, currency: "USD" | "RUB", locale: string) {
  return formatMarketMoney(value, currency, locale === "ru" ? "ru" : "en");
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [locale, session] = await Promise.all([getLocale(), getPublicSessionState()]);
  const t = dictionary[locale];

  if (!session.isAuthenticated || !session.userId) {
    redirect(`/auth?next=${encodeURIComponent("/profile")}`);
  }

  const query = await searchParams;
  const requested = Number(query.page);
  const count = await prisma.order.count({ where: { buyerUserId: session.userId } });
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const [loyaltyRow, orderRows, ratingRows] = await Promise.all([
    prisma.loyaltyPoint.findUnique({ where: { userId: session.userId }, select: { points: true } }),
    prisma.order.findMany({ where: { buyerUserId: session.userId }, include: { messages: { where: { authorRole: "admin" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
    prisma.contentRating.findMany({
      where: { userId: session.userId, contentType: "beat" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { contentId: true, rating: true, createdAt: true },
    }),
  ]);

  const points = loyaltyRow?.points ?? 0;
  const freeBeats = Math.floor(points / 100);
  const pointsRemaining = Math.max(0, 100 - points);

  const orders = orderRows.map((o) => ({ ...toOrderRow(o), beat_id: o.beatId, deliveryMp3Url: ["paid", "pending_free_checkout"].includes(o.status) ? o.deliveryMp3Url : null, newMessage: Boolean(o.messages[0] && (!o.buyerLastReadAt || o.messages[0].createdAt > o.buyerLastReadAt)) }));

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
        <h3 className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{locale === "ru" ? "Поинты: 25 за покупку, 100 за бесплатный бит" : "Points: 25 per purchase, 100 per free beat"}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{t.profileCurrentPoints}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">{points}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{locale === "ru" ? "Бесплатных битов доступно" : "Free beats available"}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">{freeBeats}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-line)] bg-[rgba(10,10,10,0.45)] p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--color-paper-400)]">{locale === "ru" ? "Поинтов до бесплатного бита" : "Points until a free beat"}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--color-paper-100)]">
              {pointsRemaining}
            </p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--color-line)] bg-[rgba(15,13,10,0.75)] p-6">
        <h3 className="text-xs uppercase tracking-[0.28em] text-[var(--color-paper-300)]">{locale === "ru" ? "Мои биты и заявки" : "My Beats and Requests"}</h3>
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
                    <p className={`mt-1 text-[10px] uppercase tracking-[0.22em] ${statusColor}`}>{order.status === "paid" || order.status === "pending_free_checkout" ? (locale === "ru" ? "Куплено" : "Purchased") : order.status === "draft" ? (locale === "ru" ? "Заявка" : "Request") : order.status}</p>
                  </div>
                  <p className="text-xs text-[var(--color-paper-300)]">
                    {t.profilePurchasedAt}: {formatDate(order.created_at, locale)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-paper-300)]">
                  <span>{formatOrderMoney(basePrice, currency, locale)}</span>
                  {order.discount_percent > 0 && <span>−{order.discount_percent}%</span>}
                  <span className="text-[var(--color-paper-100)]">{finalPrice === 0 ? (locale === "ru" ? "Бесплатно" : "Free") : formatOrderMoney(finalPrice, currency, locale)}</span>
                  {(order.status === "paid" || order.status === "pending_free_checkout") && order.deliveryMp3Url ? <a href={order.deliveryMp3Url} target="_blank" rel="noopener noreferrer" className="uppercase tracking-[0.12em] text-[var(--color-paper-100)] underline">{locale === "ru" ? "Скачать MP3" : "Download MP3"}</a> : null}
                  <span className="uppercase tracking-[0.1em]">{currency} / {locale === "ru" ? "эксклюзивная лицензия" : "exclusive license"}</span>
                  {order.provider === "contact" || order.payment_provider === "internal" ? <Link href={`/orders/${order.id}`} className="uppercase tracking-[0.12em] text-[var(--color-paper-100)] underline">{order.newMessage ? (locale === "ru" ? "Новое сообщение — открыть заявку" : "New message — open request") : locale === "ru" ? "Заявка / сообщения / бронь" : "Request / Messages / Reservation"}</Link> : null}
                  {order.license_type === "exclusive" && (order.status === "paid" || order.status === "pending_free_checkout") && (
                    <a
                      href={`/api/contracts/${order.id}/download`}
                      className="uppercase tracking-[0.12em] text-[var(--color-paper-100)] underline decoration-dotted"
                    >
                      {locale === "ru" ? "Скачать лицензию PDF" : "Download License PDF"}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {pages > 1 ? <nav aria-label={locale === "ru" ? "История покупок" : "Purchase history"} className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          {page > 1 ? <Link className="underline" href={`/profile?page=${page - 1}`}>{locale === "ru" ? "Новые заказы" : "Newer orders"}</Link> : null}
          <span>{page} / {pages}</span>
          {page < pages ? <Link className="underline" href={`/profile?page=${page + 1}`}>{locale === "ru" ? "Предыдущие покупки" : "Older purchases"}</Link> : null}
        </nav> : null}
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
