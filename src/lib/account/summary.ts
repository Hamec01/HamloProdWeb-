import { prisma } from "@/lib/db/client";

export async function getAccountSummary(userId: string) {
  const [user, purchases, unreadOrders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, email: true, loyalty: { select: { points: true } }, conversation: { select: { lastAdminAt: true, buyerLastReadAt: true } }, _count: { select: { orders: true } } } }),
    prisma.order.count({ where: { buyerUserId: userId, status: { in: ["paid", "pending_free_checkout"] } } }),
    prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM orders o WHERE o.buyer_user_id = ${userId}::uuid AND EXISTS (SELECT 1 FROM order_messages m WHERE m.order_id = o.id AND m.author_role = 'admin' AND m.created_at > COALESCE(o.buyer_last_read_at, '-infinity'::timestamptz))`,
  ]);
  if (!user) return null;
  const directUnread = Boolean(user.conversation?.lastAdminAt && (!user.conversation.buyerLastReadAt || user.conversation.lastAdminAt > user.conversation.buyerLastReadAt));
  return { displayName: user.displayName, email: user.email, points: user.loyalty?.points ?? 0, purchases, requests: user._count.orders - purchases, unread: (unreadOrders[0]?.count ?? 0) + Number(directUnread) };
}
export type AccountSummary = NonNullable<Awaited<ReturnType<typeof getAccountSummary>>>;
