import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getLocale } from "@/lib/i18n-server";
import { getUserConversation } from "@/lib/users/service";
import { prisma } from "@/lib/db/client";
import { UserConversation } from "@/components/orders/user-conversation";
export const dynamic = "force-dynamic";
export default async function ProfileMessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) redirect("/auth?next=%2Fprofile%2Fmessages");
  const locale = await getLocale();
  const ru = locale === "ru";
  const where = { buyerUserId: session.userId, messages: { some: {} } };
  const query = await searchParams;
  const count = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(count / 20));
  const requested = Number(query.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const [conversation, orders] = await Promise.all([
    getUserConversation(session.userId, { userId: session.userId, role: "buyer" }, undefined, false),
    prisma.order.findMany({ where, select: { id: true, buyerLastReadAt: true, beat: { select: { title: true } }, messages: { where: { authorRole: "admin" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { text: true, createdAt: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
  ]);
  return <div className="space-y-6">
    <Link href="/profile" className="text-sm underline">← {ru ? "Мой кабинет" : "My account"}</Link>
    <h1 className="font-sans text-4xl">{ru ? "Сообщения" : "Messages"}</h1>
    <UserConversation key={session.userId} initial={conversation} role="buyer" locale={locale} />
    <section className="case-panel space-y-4 p-5 sm:p-6">
      <h2 className="text-2xl">{ru ? "Переписка по битам" : "Beat conversations"}</h2>
      {!orders.length ? <p className="text-sm text-stone-400">{ru ? "Переписки по битам пока нет." : "No beat conversations yet."}</p> : null}
      {orders.map((order) => {
        const last = order.messages[0];
        const unread = Boolean(last && (!order.buyerLastReadAt || last.createdAt > order.buyerLastReadAt));
        return <Link key={order.id} href={`/orders/${order.id}`} className={`block border p-4 ${unread ? "border-amber-700 bg-amber-950/20" : "border-stone-700"}`}><span className="text-sm font-semibold">{order.beat.title}</span>{unread ? <span className="ml-3 text-xs text-amber-200">{ru ? "Новое сообщение" : "New message"}</span> : null}<p className="mt-2 line-clamp-2 break-words text-sm text-stone-300">{last?.text || (ru ? "Открыть заявку и переписку" : "Open request and messages")}</p></Link>;
      })}
      {pages > 1 ? <nav aria-label={ru ? "Страницы переписок" : "Conversation pages"} className="flex gap-4 text-sm">{page > 1 ? <Link className="underline" href={`?page=${page - 1}`}>{ru ? "Назад" : "Previous"}</Link> : null}<span>{page} / {pages}</span>{page < pages ? <Link className="underline" href={`?page=${page + 1}`}>{ru ? "Далее" : "Next"}</Link> : null}</nav> : null}
    </section>
  </div>;
}
