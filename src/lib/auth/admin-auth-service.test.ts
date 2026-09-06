import test from "node:test";
import assert from "node:assert/strict";
import type { UserRole } from "@prisma/client";
import { loginAdmin, logoutAdmin, type AdminUserRecord, type LoginPorts } from "./admin-auth-service";

const DUMMY = "$argon2id$v=19$m=19456,p=1,t=2$HNMWtfu/uEdj5XRypOxlAg$vob3iMXt3EfmQyC6JotdaOzAVzcBvIPvLT+WdaMg0bY";

type Calls = {
  verify: Array<{ hash: string; password: string }>;
  failures: number;
  clearedEmail: string[];
  created: number;
};

function makeLoginPorts(opts: {
  user?: AdminUserRecord | null;
  password?: string;
  preBlocked?: boolean;
  blockAfterFailure?: boolean;
}): { ports: LoginPorts; calls: Calls } {
  const calls: Calls = { verify: [], failures: 0, clearedEmail: [], created: 0 };

  return {
    calls,
    ports: {
      async findUserByEmail(email) {
        return opts.user && opts.user.email === email ? opts.user : null;
      },
      async verifyPassword(hash, password) {
        calls.verify.push({ hash, password });
        if (!opts.user || opts.user.passwordHash === null) return false;
        return hash === opts.user.passwordHash && password === opts.password;
      },
      async createSession(userId) {
        calls.created += 1;
        return { token: `token-for-${userId}`, expiresAt: new Date(Date.now() + 8 * 3600 * 1000) };
      },
      throttleKeys: (email, ip) => ({ emailKey: `e:${email}`, ipKey: `i:${ip}` }),
      async checkThrottle() {
        return opts.preBlocked ? { blocked: true, retryAfterSeconds: 600 } : { blocked: false };
      },
      async recordFailedAttempt() {
        calls.failures += 1;
        return opts.blockAfterFailure ? { blocked: true, retryAfterSeconds: 900 } : { blocked: false };
      },
      async clearEmailThrottle(key) {
        calls.clearedEmail.push(key);
      },
      dummyHash: DUMMY,
    },
  };
}

const admin: AdminUserRecord = { id: "u-admin", email: "admin@x.co", role: "ADMIN", passwordHash: "hash-admin" };
const base = { ip: "1.2.3.4", userAgent: "test", sameOrigin: true as const };

test("foreign origin is rejected before anything else", async () => {
  const { ports, calls } = makeLoginPorts({ user: admin, password: "correct-horse-1" });
  const res = await loginAdmin({ ...base, sameOrigin: false, ports, body: { email: "admin@x.co", password: "correct-horse-1" } });
  assert.equal(res.status, 403);
  assert.equal(calls.verify.length, 0);
});

test("successful login returns 200 + setSession, clears the EMAIL throttle only, no sensitive fields", async () => {
  const { ports, calls } = makeLoginPorts({ user: admin, password: "correct-horse-1" });
  const res = await loginAdmin({ ...base, ports, body: { email: " Admin@X.co ", password: "correct-horse-1" } });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.ok(res.setSession && res.setSession.token.length > 0);
  assert.deepEqual(calls.clearedEmail, ["e:admin@x.co"]);
  assert.equal(calls.created, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /hash|passwordHash|tokenHash|token-for/i);
});

test("unknown email, wrong password and wrong role all return an identical 401", async () => {
  const unknown = await loginAdmin({
    ...base,
    ports: makeLoginPorts({ user: null }).ports,
    body: { email: "nobody@x.co", password: "some-long-password" },
  });
  const wrongPw = await loginAdmin({
    ...base,
    ports: makeLoginPorts({ user: admin, password: "the-right-one" }).ports,
    body: { email: "admin@x.co", password: "the-wrong-one-XX" },
  });
  const userRecord: AdminUserRecord = { id: "u1", email: "user@x.co", role: "USER" as UserRole, passwordHash: "hash-user" };
  const wrongRole = await loginAdmin({
    ...base,
    ports: makeLoginPorts({ user: userRecord, password: "user-password-1" }).ports,
    body: { email: "user@x.co", password: "user-password-1" },
  });

  assert.equal(unknown.status, 401);
  assert.equal(wrongPw.status, 401);
  assert.equal(wrongRole.status, 401);
  assert.deepEqual(unknown.body, wrongPw.body);
  assert.deepEqual(unknown.body, wrongRole.body);
  assert.equal(unknown.setSession, undefined);
});

test("unknown email still spends a verify call against the dummy hash", async () => {
  const { ports, calls } = makeLoginPorts({ user: null });
  await loginAdmin({ ...base, ports, body: { email: "ghost@x.co", password: "irrelevant-but-long" } });
  assert.equal(calls.verify.length, 1);
  assert.equal(calls.verify[0].hash, DUMMY);
});

test("ARTIST role is denied admin access", async () => {
  const artist: AdminUserRecord = { id: "a1", email: "artist@x.co", role: "ARTIST" as UserRole, passwordHash: "hash-artist" };
  const { ports } = makeLoginPorts({ user: artist, password: "artist-password-1" });
  const res = await loginAdmin({ ...base, ports, body: { email: "artist@x.co", password: "artist-password-1" } });
  assert.equal(res.status, 401);
});

test("a pre-existing block returns 429 without touching credentials", async () => {
  const { ports, calls } = makeLoginPorts({ user: admin, password: "correct-horse-1", preBlocked: true });
  const res = await loginAdmin({ ...base, ports, body: { email: "admin@x.co", password: "correct-horse-1" } });
  assert.equal(res.status, 429);
  assert.equal(res.body.retryAfterSeconds, 600);
  assert.equal(calls.verify.length, 0);
});

test("a failed attempt that trips the limit is reported as 429", async () => {
  const { ports } = makeLoginPorts({ user: admin, password: "correct-horse-1", blockAfterFailure: true });
  const res = await loginAdmin({ ...base, ports, body: { email: "admin@x.co", password: "wrong-but-long-XX" } });
  assert.equal(res.status, 429);
});

test("malformed body returns the same 401 (no schema details leaked)", async () => {
  const { ports } = makeLoginPorts({ user: admin, password: "correct-horse-1" });
  const res = await loginAdmin({ ...base, ports, body: { email: 123 } });
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: "Invalid email or password." });
});

test("logout is idempotent and always clears the cookie on success", async () => {
  let revoked = 0;
  const ports = { async revokeSession() { revoked += 1; } };

  const withToken = await logoutAdmin({ ports, token: "abc", sameOrigin: true });
  assert.equal(withToken.status, 200);
  assert.equal(withToken.clearSession, true);
  assert.equal(revoked, 1);

  const withoutToken = await logoutAdmin({ ports, token: undefined, sameOrigin: true });
  assert.equal(withoutToken.status, 200);
  assert.equal(withoutToken.clearSession, true);
  assert.equal(revoked, 1);
});

test("logout propagates a failed revoke (route must return 503 and keep the cookie)", async () => {
  const ports = { async revokeSession() { throw new Error("db down"); } };
  await assert.rejects(logoutAdmin({ ports, token: "abc", sameOrigin: true }), /db down/);
});

test("logout rejects a foreign origin", async () => {
  const res = await logoutAdmin({ ports: { async revokeSession() {} }, token: "abc", sameOrigin: false });
  assert.equal(res.status, 403);
});
