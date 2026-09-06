/**
 * DB-backed concurrency tests for the login throttle. Skipped without
 * DATABASE_URL + SESSION_SECRET.
 */

import test from "node:test";
import assert from "node:assert/strict";

const CONFIGURED = Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET);

test("throttle counting", { skip: !CONFIGURED && "no DATABASE_URL / SESSION_SECRET" }, async (t) => {
  const { prisma } = await import("@/lib/db/client");
  const { emailThrottleKey, ipThrottleKey, checkThrottle, recordFailedAttempt, clearEmailThrottle } = await import("./throttle");

  const email = `thr-${crypto.randomUUID()}@test.local`;
  const ip = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
  const emailKey = emailThrottleKey(email);
  const ipKey = ipThrottleKey(ip);

  t.after(async () => {
    await prisma.authThrottle.deleteMany({ where: { keyHash: { in: [emailKey, ipKey] } } });
  });

  await t.test("concurrent failed attempts do not lose increments", async () => {
    await prisma.authThrottle.deleteMany({ where: { keyHash: { in: [emailKey, ipKey] } } });

    const N = 8;
    await Promise.all(Array.from({ length: N }, () => recordFailedAttempt({ emailKey, ipKey })));

    const emailRow = await prisma.authThrottle.findUnique({ where: { keyHash: emailKey } });
    const ipRow = await prisma.authThrottle.findUnique({ where: { keyHash: ipKey } });
    assert.equal(emailRow?.attempts, N, "email attempts must equal the number of parallel failures");
    assert.equal(ipRow?.attempts, N, "ip attempts must equal the number of parallel failures");
  });

  await t.test("email limit (10) blocks before the IP limit (30)", async () => {
    await prisma.authThrottle.deleteMany({ where: { keyHash: { in: [emailKey, ipKey] } } });

    let status = await recordFailedAttempt({ emailKey, ipKey });
    for (let i = 1; i < 10 && !status.blocked; i += 1) {
      status = await recordFailedAttempt({ emailKey, ipKey });
    }

    assert.equal(status.blocked, true, "blocked at the email limit");
    const ipRow = await prisma.authThrottle.findUnique({ where: { keyHash: ipKey } });
    assert.ok((ipRow?.attempts ?? 0) < 30, "IP scope is not yet at its own limit");
    assert.equal((await checkThrottle({ emailKey, ipKey })).blocked, true);
  });

  await t.test("a successful login clears the email scope but leaves the IP scope", async () => {
    await clearEmailThrottle(emailKey);

    assert.equal(await prisma.authThrottle.findUnique({ where: { keyHash: emailKey } }), null);
    const ipRow = await prisma.authThrottle.findUnique({ where: { keyHash: ipKey } });
    assert.ok(ipRow, "IP row survives a successful login");
  });
});
