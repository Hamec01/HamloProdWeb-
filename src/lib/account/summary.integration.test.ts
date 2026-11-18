import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getAccountSummary } from "./summary";

test("account menu summary separates purchases/requests, counts unread threads and excludes private notes/delivery", { skip: process.env.LICENSE_INTEGRATION_TEST !== "1", timeout: 30000 }, async (t) => {
  assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith("/hamloprod_license_test"));
  const tag = randomUUID();
  const owner = await prisma.user.create({ data: { email: `menu-${tag}@example.invalid`, displayName: "Menu Artist" } });
  const admin = await prisma.user.create({ data: { email: `menu-admin-${tag}@example.invalid`, role: "ADMIN" } });
  const other = await prisma.user.create({ data: { email: `menu-other-${tag}@example.invalid` } });
  const beatIds: string[] = [];
  t.after(async () => {
    await prisma.adminUserNote.deleteMany({ where: { userId: owner.id } });
    await prisma.order.deleteMany({ where: { beatId: { in: beatIds } } });
    await prisma.beat.deleteMany({ where: { id: { in: beatIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, admin.id, other.id] } } });
    await prisma.$disconnect();
  });
  const orders = [];
  for (const status of ["paid", "draft", "failed"]) {
    const id = randomUUID(); const beat = await prisma.beat.create({ data: { title: `Menu ${status}`, slug: `menu-${id}`, caseNumber: `MENU-${id}`, genre: "trap" } }); beatIds.push(beat.id);
    orders.push(await prisma.order.create({ data: { beatId: beat.id, buyerUserId: owner.id, buyerEmail: owner.email, status, basePriceUsd: 100, finalPriceUsd: 100, deliveryMp3Url: "https://drive.google.com/file/d/private_1234567890/view" } }));
  }
  await prisma.loyaltyPoint.create({ data: { userId: owner.id, userEmail: owner.email, points: 25 } });
  const now = new Date();
  await prisma.userConversation.create({ data: { userId: owner.id, lastAdminAt: now } });
  await prisma.orderMessage.create({ data: { orderId: orders[0].id, authorUserId: admin.id, authorRole: "admin", text: "Your purchase is ready", createdAt: now } });
  await prisma.adminUserNote.create({ data: { id: randomUUID(), userId: owner.id, authorId: admin.id, text: "PRIVATE PRODUCER NOTE" } });
  const summary = await getAccountSummary(owner.id);
  assert.equal(summary?.points, 25); assert.equal(summary?.purchases, 1); assert.equal(summary?.requests, 2); assert.equal(summary?.unread, 2);
  assert.ok(!JSON.stringify(summary).includes("PRIVATE PRODUCER NOTE")); assert.ok(!JSON.stringify(summary).includes("drive.google.com"));
  const stranger = await getAccountSummary(other.id);
  assert.equal(stranger?.email, other.email); assert.equal(stranger?.points, 0); assert.equal(stranger?.purchases, 0); assert.equal(stranger?.unread, 0);
  await prisma.order.update({ where: { id: orders[0].id }, data: { buyerLastReadAt: now } });
  await prisma.userConversation.update({ where: { userId: owner.id }, data: { buyerLastReadAt: now } });
  assert.equal((await getAccountSummary(owner.id))?.unread, 0);
});
