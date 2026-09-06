/**
 * DB-backed concurrency tests. Run only when DATABASE_URL + SESSION_SECRET are
 * present (local dev via `npm test`, which loads `.env`). Skipped in CI.
 */

import test from "node:test";
import assert from "node:assert/strict";

const CONFIGURED = Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET);

test("session rotation is race-safe", { skip: !CONFIGURED && "no DATABASE_URL / SESSION_SECRET" }, async (t) => {
  const { prisma } = await import("@/lib/db/client");
  const { createAdminSession, rotateAdminSession, validateAdminSession } = await import("./session");

  const email = `rot-${crypto.randomUUID()}@test.local`;
  const user = await prisma.user.create({ data: { email, role: "ADMIN", passwordHash: null } });

  t.after(async () => {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  await t.test("two parallel refreshes create exactly one new session", async () => {
    const { token } = await createAdminSession(user.id);

    const [a, b] = await Promise.all([
      rotateAdminSession(token, { ip: "1.1.1.1" }),
      rotateAdminSession(token, { ip: "2.2.2.2" }),
    ]);

    const winners = [a, b].filter((r) => r !== null);
    assert.equal(winners.length, 1, "exactly one rotation should win");

    // old token is dead
    assert.equal((await validateAdminSession(token)).isAuthenticated, false);
    // the one new token is valid
    assert.equal((await validateAdminSession(winners[0]!.token)).isAuthenticated, true);

    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    assert.equal(active, 1, "exactly one active session remains");
  });

  await t.test("rotating an already-revoked token returns null (not throw)", async () => {
    const { token } = await createAdminSession(user.id);
    await rotateAdminSession(token);
    assert.equal(await rotateAdminSession(token), null);
  });

  await t.test("rotating an expired session returns null", async () => {
    const { token } = await createAdminSession(user.id);
    const { hashSessionToken } = await import("./session");
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal(await rotateAdminSession(token), null);
  });
});
