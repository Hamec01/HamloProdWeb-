import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { OrderActor } from "@/lib/orders/reservations";

export async function requireUserAdmin(adminId: string, db: PrismaClient = prisma) {
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { role: true } });
  if (admin?.role !== "ADMIN") throw new Error("FORBIDDEN");
}
async function requireTarget(userId: string, actor: OrderActor) {
  if (actor.role === "admin") await requireUserAdmin(actor.userId);
  else if (actor.userId !== userId) throw new Error("USER_NOT_FOUND");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } });
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

export async function getUserConversation(userId: string, actor: OrderActor, before?: string, markRead = true) {
  const user = await requireTarget(userId, actor);
  const cursor = before ? await prisma.userMessage.findFirst({ where: { id: before, userId }, select: { id: true } }) : null;
  if (before && !cursor) throw new Error("BAD_CURSOR");
  const rows = await prisma.userMessage.findMany({ where: { userId }, ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 });
  const messages = rows.slice(0, 50).reverse();
  // Only the current page is read; loading older history cannot advance the marker.
  if (markRead && !before && messages.length) {
    const field = actor.role === "admin" ? "adminLastReadAt" : "buyerLastReadAt";
    const newest = messages.at(-1)!.createdAt;
    await prisma.userConversation.updateMany({ where: { userId, OR: [{ [field]: null }, { [field]: { lt: newest } }] }, data: { [field]: newest } });
  }
  return { user: { id: user.id, displayName: user.displayName }, messages: messages.map((message) => ({ id: message.id, role: message.authorRole, text: message.text, createdAt: message.createdAt.toISOString() })), hasMore: rows.length > 50 };
}

export async function sendUserMessage(userId: string, actor: OrderActor, text: string, clientMessageId: string) {
  await requireTarget(userId, actor);
  return prisma.$transaction(async (tx) => {
    // Serialise thread writes so read/unread timestamps and retry identity agree.
    await tx.userConversation.upsert({ where: { userId }, create: { userId }, update: {} });
    await tx.$queryRaw`SELECT user_id FROM user_conversations WHERE user_id = ${userId}::uuid FOR UPDATE`;
    const prior = await tx.userMessage.findUnique({ where: { userId_authorId_clientMessageId: { userId, authorId: actor.userId, clientMessageId } } });
    if (prior) {
      if (prior.text !== text || prior.authorRole !== actor.role) throw new Error("REQUEST_CONFLICT");
      return { id: prior.id };
    }
    const thread = await tx.userConversation.findUniqueOrThrow({ where: { userId } });
    const createdAt = new Date(Math.max(Date.now(), (thread.lastAdminAt?.getTime() ?? 0) + 1, (thread.lastBuyerAt?.getTime() ?? 0) + 1));
    const message = await tx.userMessage.create({ data: { userId, authorId: actor.userId, authorRole: actor.role, text, clientMessageId, createdAt } });
    await tx.userConversation.update({ where: { userId }, data: actor.role === "admin" ? { lastAdminAt: message.createdAt } : { lastBuyerAt: message.createdAt } });
    return { id: message.id };
  });
}

export async function listPrivateNotes(userId: string, adminId: string, before?: string) {
  await requireUserAdmin(adminId);
  const cursor = before ? await prisma.adminUserNote.findFirst({ where: { id: before, userId }, select: { id: true } }) : null;
  if (before && !cursor) throw new Error("BAD_CURSOR");
  const rows = await prisma.adminUserNote.findMany({ where: { userId }, ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, select: { id: true, text: true, createdAt: true } });
  return { items: rows.slice(0, 20).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), hasMore: rows.length > 20 };
}
export async function addPrivateNote(userId: string, adminId: string, text: string, requestId: string) {
  await requireUserAdmin(adminId);
  if (!await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new Error("USER_NOT_FOUND");
  const note = await prisma.adminUserNote.upsert({ where: { id: requestId }, create: { id: requestId, userId, authorId: adminId, text }, update: {} });
  if (note.userId !== userId || note.authorId !== adminId || note.text !== text) throw new Error("REQUEST_CONFLICT");
  return { id: note.id };
}

export async function listPointGrants(userId: string, before?: string) {
  const cursor = before ? await prisma.loyaltyGrant.findFirst({ where: { id: before, userId }, select: { id: true } }) : null;
  if (before && !cursor) throw new Error("BAD_CURSOR");
  const rows = await prisma.loyaltyGrant.findMany({ where: { userId }, ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, select: { id: true, amount: true, reason: true, createdAt: true } });
  return { items: rows.slice(0, 20).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), hasMore: rows.length > 20 };
}
export async function grantUserPoints(userId: string, adminId: string, amount: number, reason: string, requestId: string, db: PrismaClient = prisma) {
  await requireUserAdmin(adminId, db);
  if (!Number.isInteger(amount) || amount < 1 || amount > 10000 || !reason.trim() || reason.length > 500) throw new Error("INVALID_GRANT");
  return db.$transaction(async (tx) => {
    const targets = await tx.$queryRaw<{ email: string }[]>`SELECT email FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`;
    if (!targets.length) throw new Error("USER_NOT_FOUND");
    const prior = await tx.loyaltyGrant.findUnique({ where: { id: requestId } });
    if (prior) {
      if (prior.userId !== userId || prior.authorId !== adminId || prior.amount !== amount || prior.reason !== reason) throw new Error("REQUEST_CONFLICT");
    } else {
      await tx.loyaltyPoint.upsert({ where: { userId }, create: { userId, userEmail: targets[0].email, points: 0 }, update: {} });
      const credited = await tx.loyaltyPoint.updateMany({ where: { userId, points: { lte: 2147483647 - amount } }, data: { points: { increment: amount } } });
      if (credited.count !== 1) throw new Error("BALANCE_LIMIT");
      await tx.loyaltyGrant.create({ data: { id: requestId, userId, authorId: adminId, amount, reason } });
    }
    const balance = await tx.loyaltyPoint.findUniqueOrThrow({ where: { userId }, select: { points: true } });
    return { id: requestId, points: balance.points };
  }, { timeout: 15000 });
}

export function userSearchWhere(query: string): Prisma.UserWhereInput {
  return query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }] } : {};
}
export const unreadCustomerMessage = (thread: { lastBuyerAt: Date | null; adminLastReadAt: Date | null } | null) => Boolean(thread?.lastBuyerAt && (!thread.adminLastReadAt || thread.lastBuyerAt > thread.adminLastReadAt));
export const unreadProducerMessage = (thread: { lastAdminAt: Date | null; buyerLastReadAt: Date | null } | null) => Boolean(thread?.lastAdminAt && (!thread.buyerLastReadAt || thread.lastAdminAt > thread.buyerLastReadAt));
