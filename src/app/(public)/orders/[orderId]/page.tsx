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
    <Link className="inline-block border border-[var(--color-line)] px-4 py-2 text-sm" href={actor.role === "admin" ? "/admin/licenses" : "/profile"}>{locale === "ru" ? "Назад в кабинет" : "Back to account"}</Link>
    <OrderConversation key={orderId} initial={initial} role={actor.role} locale={locale} />
  </section>;
}
