import { ManualLicenseRequests } from "@/components/admin/manual-license-requests";
import { LicenseSellerForm } from "@/components/admin/license-seller-form";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { AdminLicenseManager } from "@/components/admin/admin-license-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getAdminBeats } from "@/services/content";
import { redirect } from "next/navigation";
import { isBeatStripeReady } from "@/lib/checkout/config";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminLicensesPage() {
  const session = await requireAdminSession();
  if (session.role !== "ADMIN") redirect("/admin/dashboard");
  const [beats, orders, seller, requests, stripeRequests] = await Promise.all([
    getAdminBeats(),
    prisma.order.findMany({
      where: { licenseType: "exclusive", status: { in: ["paid", "pending_free_checkout"] } },
      include: { beat: { select: { title: true } }, messages: { where: { authorRole: "buyer" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getSellerIdentity({ strict: false }),
    prisma.order.findMany({ where: { provider: "contact", licenseType: "exclusive", status: "draft" }, include: { beat: { select: { title: true, reservationOrderId: true, reservationExpiresAt: true } }, contract: { select: { htmlSnapshot: true } }, messages: { where: { authorRole: "buyer" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { provider: "stripe", status: "pending_payment" }, include: { beat: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <section className="case-panel p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">Exclusive sales</p>
        <h1 className="mt-2 font-sans text-5xl uppercase tracking-[0.06em]">Заявки и лицензии</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-paper-200)]">
          Настройки продавца, ручное оформление продаж и PDF всех оплаченных заказов. Лицензии создаются по двуязычному шаблону LICENSEMAKER.
        </p>
      </section>

      <section className="case-panel space-y-3 p-5">
        <h2 className="text-2xl">Stripe и автоматическая выдача</h2>
        <p className="text-sm text-stone-200">{isBeatStripeReady() ? "Онлайн-оплата Stripe включена." : "Онлайн-оплата Stripe пока выключена."} Ключ Stripe: {process.env.STRIPE_SECRET_KEY?.trim() ? "добавлен" : "не добавлен"}. Подтверждения оплаты: {process.env.STRIPE_WEBHOOK_SECRET?.trim() ? "настроены" : "не настроены"}.</p>
        <p className="text-sm text-stone-300">Добавь ссылку Google Диска в редактировании бита. Тогда покупатель сможет оплатить картой в USD и получить PDF, ссылку и 25 поинтов автоматически.</p>
        <Link href="/admin/beats" className="inline-block text-sm text-amber-200 underline">Биты → Edit → Файл бита после покупки</Link>
      </section>

      <details className="case-panel p-5">
        <summary className="cursor-pointer text-sm uppercase tracking-[0.12em]">Данные продавца и подпись</summary>
        <div className="mt-5"><LicenseSellerForm identity={seller} /></div>
      </details>

      {stripeRequests.length ? <section className="case-panel space-y-4 p-5">
        <h2 className="text-2xl">Ожидают оплаты Stripe</h2>
        {stripeRequests.map((order) => <div key={order.id} className="flex flex-wrap justify-between gap-3 border border-stone-700 p-4 text-sm"><span>{order.beat.title} · {order.buyerName || order.buyerEmail}</span><Link href={`/orders/${order.id}`} className="text-amber-200 underline">Открыть платёж / проверить статус</Link></div>)}
      </section> : null}

      <ManualLicenseRequests orders={requests.map((order) => ({ id: order.id, beatTitle: order.beat.title, buyerName: order.buyerName || order.buyerEmail, buyerEmail: order.buyerEmail, amount: order.finalPrice, currency: order.currency, hasContract: Boolean(order.termsAcceptedAt && order.personalDataConsentAt && order.contract?.htmlSnapshot.startsWith("<!doctype html>")), newMessage: Boolean(order.messages[0] && (!order.adminLastReadAt || order.messages[0].createdAt > order.adminLastReadAt)), reservationExpiresAt: order.beat.reservationOrderId === order.id ? order.beat.reservationExpiresAt?.toISOString() ?? null : null }))} />

      <AdminLicenseManager
        beats={beats}
        canCreateSales
        sales={orders.map((order) => ({
          id: order.id,
          beatTitle: order.beat.title,
          buyerName: order.buyerName ?? order.buyerEmail,
          buyerEmail: order.buyerEmail,
          amount: order.finalPrice,
          currency: order.currency === "RUB" ? "RUB" as const : "USD" as const,
          createdAt: order.createdAt.toISOString(),
          hasPdf: order.contractPdfKey !== null,
          newMessage: Boolean(order.messages[0] && (!order.adminLastReadAt || order.messages[0].createdAt > order.adminLastReadAt)),
        }))}
      />
    </div>
  );
}
