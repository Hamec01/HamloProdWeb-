import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth/session";
import { getUserConversation, listPointGrants, listPrivateNotes } from "@/lib/users/service";
import { UserConversation } from "@/components/orders/user-conversation";
import { AdminUserTools } from "@/components/admin/admin-user-tools";
export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ page?: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "ADMIN" || !session.userId) redirect("/admin/dashboard");
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, role: true, createdAt: true, emailVerifiedAt: true, loyalty: { select: { points: true } } } });
  if (!user) notFound();
  const query = await searchParams;
  const orderCount = await prisma.order.count({ where: { buyerUserId: userId } });
  const pages = Math.max(1, Math.ceil(orderCount / 20));
  const requested = Number(query.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const [conversation, notes, grants, orders] = await Promise.all([
    getUserConversation(userId, { userId: session.userId, role: "admin" }, undefined, false), listPrivateNotes(userId, session.userId), listPointGrants(userId),
    prisma.order.findMany({ where: { buyerUserId: userId }, select: { id: true, status: true, createdAt: true, beat: { select: { title: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }),
  ]);
  return <div className="min-w-0 space-y-6">
    <Link href="/admin/users" className="text-sm underline">← Все пользователи</Link>
    <section className="case-panel space-y-3 p-5 sm:p-6">
      <h1 className="break-words font-sans text-4xl">{user.displayName || user.email}</h1>
      <p className="break-all text-sm text-stone-200">{user.email}</p>
      <p className="text-xs text-stone-400">{user.role} · Регистрация: {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Europe/Helsinki" }).format(user.createdAt)} · {user.emailVerifiedAt ? "Email подтверждён" : "Email не подтверждён"}</p>
      <p className="text-sm">Баланс: <strong>{user.loyalty?.points ?? 0}</strong> поинтов · Заказов: {orderCount}</p>
    </section>
    <UserConversation key={userId} initial={conversation} role="admin" />
    <AdminUserTools key={`tools-${userId}`} userId={userId} initialNotes={notes} initialGrants={grants} initialPoints={user.loyalty?.points ?? 0} />
    <section className="case-panel space-y-4 p-5 sm:p-6">
      <h2 className="text-2xl">Покупки и заявки</h2>
      {!orders.length ? <p className="text-sm text-stone-400">Заказов пока нет.</p> : null}
      {orders.map((order) => <article key={order.id} className="flex flex-wrap justify-between gap-3 border border-stone-700 p-4 text-sm"><span>{order.beat.title} · {order.status}</span><Link className="text-amber-200 underline" href={`/orders/${order.id}`}>Открыть заказ / PDF / MP3</Link></article>)}
      {pages > 1 ? <nav className="flex gap-4 text-sm" aria-label="Заказы пользователя">{page > 1 ? <Link className="underline" href={`?page=${page - 1}`}>Назад</Link> : null}<span>{page} / {pages}</span>{page < pages ? <Link className="underline" href={`?page=${page + 1}`}>Далее</Link> : null}</nav> : null}
    </section>
  </div>;
}
