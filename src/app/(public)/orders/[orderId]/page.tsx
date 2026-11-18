import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { orderActor } from "@/lib/orders/access";
import { getConversation } from "@/lib/orders/conversation";
import { getLocale } from "@/lib/i18n-server";
import { OrderConversation } from "@/components/orders/order-conversation";

export const dynamic = "force-dynamic";
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const actor = await orderActor();
  if (!actor) redirect(`/auth?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  const locale = await getLocale();
  let initial: Awaited<ReturnType<typeof getConversation>>;
  try { initial = await getConversation(orderId, actor); } catch { notFound(); }
  return <section className="space-y-6">
    <nav className="flex flex-wrap gap-3" aria-label={locale === "ru" ? "Навигация по заявке" : "Request navigation"}>
      <Link className="border border-[var(--color-line)] px-4 py-3 text-sm" href={`/beats/${encodeURIComponent(initial.order.beatSlug)}`}>{locale === "ru" ? "← К биту" : "← Back to beat"}</Link>
      <Link className="border border-[var(--color-line)] px-4 py-3 text-sm" href="/beats">{locale === "ru" ? "Ко всем битам" : "All beats"}</Link>
      <Link className="border border-[var(--color-line)] px-4 py-3 text-sm" href={actor.role === "admin" ? "/admin/licenses" : "/profile"}>{locale === "ru" ? "В кабинет" : "My account"}</Link>
    </nav>
    <OrderConversation key={orderId} initial={initial} role={actor.role} locale={locale} />
  </section>;
}
