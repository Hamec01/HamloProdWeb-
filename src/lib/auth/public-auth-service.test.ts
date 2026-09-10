import test from "node:test";
import assert from "node:assert/strict";
import { loginBuyer, logoutBuyer, signupBuyer, type PublicAuthPorts, type PublicUserRecord } from "./public-auth-service";

const DUMMY = "$argon2id$v=19$m=19456,p=1,t=2$HNMWtfu/uEdj5XRypOxlAg$vob3iMXt3EfmQyC6JotdaOzAVzcBvIPvLT+WdaMg0bY";

type Calls = {
  verify: Array<{ hash: string; password: string }>;
  created: Array<{ email: string }>;
  upgraded: Array<{ userId: string; hash: string }>;
  signedIn: string[];
  sessions: number;
  failures: number;
  clearedEmail: string[];
};

function makePorts(opts: {
  user?: PublicUserRecord | null;
  password?: string;
  legacy?: boolean;
  preBlocked?: boolean;
  blockAfterFailure?: boolean;
}): { ports: PublicAuthPorts; calls: Calls } {
  const calls: Calls = { verify: [], created: [], upgraded: [], signedIn: [], sessions: 0, failures: 0, clearedEmail: [] };
  let user = opts.user ?? null;

  return {
    calls,
    ports: {
      async findUserByEmail(email) {
        return user && user.email === email ? user : null;
      },
      async createUser(input) {
        calls.created.push({ email: input.email });
        user = { id: "u-new", email: input.email, passwordHash: input.passwordHash };
        return user;
      },
      async verifyPassword(hash, password) {
        calls.verify.push({ hash, password });
        if (!user || user.passwordHash === null) return false;
        return hash === user.passwordHash && password === opts.password;
      },
      isLegacyHash: (hash) => (opts.legacy ? hash === opts.user?.passwordHash : hash.startsWith("$2")),
      async hashPassword(password) {
        return `argon2:${password}`;
      },
      async upgradePasswordHash(userId, hash) {
        calls.upgraded.push({ userId, hash });
        if (user) user = { ...user, passwordHash: hash };
      },
      async recordSignIn(userId) {
        calls.signedIn.push(userId);
      },
      async createSession(userId) {
        calls.sessions += 1;
        return { token: `tok-${userId}`, expiresAt: new Date(Date.now() + 1000) };
      },
      throttleKeys: (email, ip) => ({ emailKey: `e:${email}`, ipKey: `i:${ip}` }),
      async checkThrottle() {
        return opts.preBlocked ? { blocked: true, retryAfterSeconds: 300 } : { blocked: false };
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

const base = { ip: "9.9.9.9", userAgent: "t", sameOrigin: true as const };
const argonUser: PublicUserRecord = { id: "u1", email: "buyer@x.co", passwordHash: "$argon2id$real" };
const bcryptUser: PublicUserRecord = { id: "u2", email: "old@x.co", passwordHash: "$2a$10$abcdefghijklmnopqrstuv" };

test("foreign origin is rejected before any DB work (login + signup + logout)", async () => {
  const p = makePorts({ user: argonUser, password: "correcthorse" });
  assert.equal((await loginBuyer({ ...base, sameOrigin: false, ports: p.ports, body: {} })).status, 403);
  assert.equal((await signupBuyer({ ...base, sameOrigin: false, ports: p.ports, body: {} })).status, 403);
  assert.equal((await logoutBuyer({ ports: { async revokeSession() {} }, token: "x", sameOrigin: false })).status, 403);
  assert.equal(p.calls.verify.length, 0);
});

test("login: correct password → 200 + session, email throttle cleared, no secrets in body", async () => {
  const { ports, calls } = makePorts({ user: argonUser, password: "correcthorse" });
  const res = await loginBuyer({ ...base, ports, body: { email: " Buyer@X.co ", password: "correcthorse" } });
  assert.equal(res.status, 200);
  assert.ok(res.setSession?.token);
  assert.deepEqual(calls.clearedEmail, ["e:buyer@x.co"]);
  assert.equal(calls.sessions, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /argon2|\$2a|tok-/);
});

test("login: unknown email and wrong password are the identical 401, and unknown still hits the dummy hash", async () => {
  const unknown = await loginBuyer({ ...base, ports: makePorts({ user: null }).ports, body: { email: "ghost@x.co", password: "whatever8" } });
  const wrong = makePorts({ user: argonUser, password: "correcthorse" });
  const wrongRes = await loginBuyer({ ...base, ports: wrong.ports, body: { email: "buyer@x.co", password: "wrongwrong" } });
  assert.equal(unknown.status, 401);
  assert.equal(wrongRes.status, 401);
  assert.deepEqual(unknown.body, wrongRes.body);
  assert.equal(unknown.setSession, undefined);

  const ghost = makePorts({ user: null });
  await loginBuyer({ ...base, ports: ghost.ports, body: { email: "ghost@x.co", password: "whatever8" } });
  assert.equal(ghost.calls.verify[0]?.hash, DUMMY);
});

test("login: an account with passwordHash = null cannot log in (Google-only)", async () => {
  const google: PublicUserRecord = { id: "g", email: "g@x.co", passwordHash: null };
  const { ports } = makePorts({ user: google, password: "anything8" });
  const res = await loginBuyer({ ...base, ports, body: { email: "g@x.co", password: "anything8" } });
  assert.equal(res.status, 401);
});

test("login: a legacy bcrypt hash that verifies is upgraded to Argon2id", async () => {
  const { ports, calls } = makePorts({ user: bcryptUser, password: "legacypass", legacy: true });
  const res = await loginBuyer({ ...base, ports, body: { email: "old@x.co", password: "legacypass" } });
  assert.equal(res.status, 200);
  assert.equal(calls.upgraded.length, 1);
  assert.equal(calls.upgraded[0].userId, "u2");
  assert.equal(calls.upgraded[0].hash, "argon2:legacypass");
  assert.equal(calls.sessions, 1);
});

test("login: pre-existing block → 429, credentials untouched", async () => {
  const { ports, calls } = makePorts({ user: argonUser, password: "correcthorse", preBlocked: true });
  const res = await loginBuyer({ ...base, ports, body: { email: "buyer@x.co", password: "correcthorse" } });
  assert.equal(res.status, 429);
  assert.equal(calls.verify.length, 0);
});

test("login: a failed attempt that trips the limit becomes 429", async () => {
  const { ports } = makePorts({ user: argonUser, password: "correcthorse", blockAfterFailure: true });
  const res = await loginBuyer({ ...base, ports, body: { email: "buyer@x.co", password: "nope" } });
  assert.equal(res.status, 429);
});

test("signup: new email creates the user (Argon2id) and a session", async () => {
  const { ports, calls } = makePorts({ user: null });
  const res = await signupBuyer({ ...base, ports, body: { email: "fresh@x.co", password: "goodpass1" } });
  assert.equal(res.status, 201);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].email, "fresh@x.co");
  assert.equal(calls.sessions, 1);
});

test("signup: an already-registered email is handled as a login attempt (no enumeration)", async () => {
  const okPw = makePorts({ user: argonUser, password: "correcthorse" });
  const ok = await signupBuyer({ ...base, ports: okPw.ports, body: { email: "buyer@x.co", password: "correcthorse" } });
  assert.equal(ok.status, 200);
  assert.equal(okPw.calls.created.length, 0);

  const badPw = makePorts({ user: argonUser, password: "correcthorse" });
  const bad = await signupBuyer({ ...base, ports: badPw.ports, body: { email: "buyer@x.co", password: "wrongpass1" } });
  assert.equal(bad.status, 401);
  assert.equal(badPw.calls.created.length, 0);
});

test("signup: short password is rejected with a 400", async () => {
  const { ports } = makePorts({ user: null });
  const res = await signupBuyer({ ...base, ports, body: { email: "x@x.co", password: "short" } });
  assert.equal(res.status, 400);
});

test("logout: idempotent, always clears the cookie, propagates a failed revoke", async () => {
  let n = 0;
  const ok = await logoutBuyer({ ports: { async revokeSession() { n += 1; } }, token: "abc", sameOrigin: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.clearSession, true);
  assert.equal(n, 1);
  await assert.rejects(logoutBuyer({ ports: { async revokeSession() { throw new Error("db"); } }, token: "abc", sameOrigin: true }), /db/);
});
