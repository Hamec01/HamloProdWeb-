import { ManualLicenseRequests } from "@/components/admin/manual-license-requests";
import { LicenseSellerForm } from "@/components/admin/license-seller-form";
import { getSellerIdentity } from "@/lib/contracts/seller";
import { AdminLicenseManager } from "@/components/admin/admin-license-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getAdminBeats } from "@/services/content";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLicensesPage() {
  const session = await requireAdminSession();
  if (session.role !== "ADMIN") redirect("/admin/dashboard");
  const [beats, orders, seller, requests] = await Promise.all([
    getAdminBeats(),
    prisma.order.findMany({
      where: { licenseType: "exclusive", status: { in: ["paid", "pending_free_checkout"] } },
      include: { beat: { select: { title: true } }, messages: { where: { authorRole: "buyer" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getSellerIdentity({ strict: false }),
    prisma.order.findMany({ where: { provider: "contact", licenseType: "exclusive", status: "draft" }, include: { beat: { select: { title: true, reservationOrderId: true, reservationExpiresAt: true } }, contract: { select: { htmlSnapshot: true } }, messages: { where: { authorRole: "buyer" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
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

      <details className="case-panel p-5">
        <summary className="cursor-pointer text-sm uppercase tracking-[0.12em]">Данные продавца и подпись</summary>
        <div className="mt-5"><LicenseSellerForm identity={seller} /></div>
      </details>

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
