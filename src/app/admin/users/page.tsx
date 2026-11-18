import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { requireAdminSession } from "@/lib/auth/session";
import { userSearchWhere, unreadCustomerMessage } from "@/lib/users/service";
import { AdminUsersRefresh } from "@/components/admin/admin-users-refresh";
export const dynamic = "force-dynamic";
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Europe/Helsinki" }).format(value) : "—";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await requireAdminSession();
  if (session.role !== "ADMIN") redirect("/admin/dashboard");
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const where = userSearchWhere(q);
  const [total, matched] = await Promise.all([prisma.user.count(), prisma.user.count({ where })]);
  const pages = Math.max(1, Math.ceil(matched / 25));
  const requested = Number(query.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const users = await prisma.user.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25, select: { id: true, email: true, displayName: true, role: true, createdAt: true, lastSignInAt: true, loyalty: { select: { points: true } }, conversation: { select: { lastBuyerAt: true, adminLastReadAt: true } }, _count: { select: { orders: { where: { status: { in: ["paid", "pending_free_checkout"] } } } } } } });
  const pageUrl = (value: number) => `/admin/users?${new URLSearchParams({ q, page: String(value) })}`;
  return <div className="min-w-0 space-y-6">
    <AdminUsersRefresh />
    <section className="case-panel space-y-4 p-5 sm:p-6">
      <h1 className="font-sans text-4xl uppercase">Пользователи</h1>
      <p className="text-sm text-stone-300">Зарегистрировано: <strong>{total}</strong>{q ? ` · Найдено: ${matched}` : ""}. Открой аккаунт, чтобы написать, сохранить пометку или начислить поинты.</p>
      <form method="get" className="flex flex-wrap gap-3">
        <label htmlFor="user-search" className="sr-only">Поиск пользователей</label>
        <input id="user-search" type="search" name="q" defaultValue={q} placeholder="Имя или email" maxLength={100} className="min-w-0 flex-1 border border-stone-600 bg-black/40 px-3 py-3 text-base text-stone-100" />
        <button type="submit" className="border border-stone-600 px-4 py-3 text-sm">Найти</button>
        {q ? <Link href="/admin/users" className="px-3 py-3 text-sm underline">Все пользователи</Link> : null}
      </form>
    </section>
    <section className="case-panel overflow-x-auto p-4">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-stone-700 text-xs uppercase tracking-wider text-stone-400"><tr><th className="p-3">Аккаунт</th><th className="p-3">Регистрация / вход</th><th className="p-3">Покупки</th><th className="p-3">Поинты</th><th className="p-3">Действия</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id} className="border-b border-stone-800">
          <td className="p-3"><Link href={`/admin/users/${user.id}`} className="font-semibold underline">{user.displayName || user.email}</Link><p className="mt-1 break-all text-xs text-stone-300">{user.email}</p><p className="mt-1 text-xs text-stone-400">{user.role}</p>{unreadCustomerMessage(user.conversation) ? <p className="mt-2 text-xs text-amber-200">Новое сообщение</p> : null}</td>
          <td className="p-3 text-xs text-stone-300"><p>{date(user.createdAt)}</p><p className="mt-1">Вход: {date(user.lastSignInAt)}</p></td>
          <td className="p-3">{user._count.orders}</td><td className="p-3">{user.loyalty?.points ?? 0}</td>
          <td className="p-3"><Link href={`/admin/users/${user.id}`} className="text-amber-200 underline">Открыть / написать</Link></td>
        </tr>)}</tbody>
      </table>
      {!users.length ? <p className="p-4 text-sm text-stone-300">Пользователи не найдены.</p> : null}
    </section>
    {pages > 1 ? <nav aria-label="Страницы пользователей" className="flex flex-wrap gap-5 text-sm">
      {page > 1 ? <Link href={pageUrl(page - 1)} className="underline">Назад</Link> : null}<span>{page} / {pages}</span>{page < pages ? <Link href={pageUrl(page + 1)} className="underline">Далее</Link> : null}
    </nav> : null}
  </div>;
}
