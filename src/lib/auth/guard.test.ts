import test from "node:test";
import assert from "node:assert/strict";
import type { AdminSessionState } from "@/lib/auth/session";
import { requireAdminMutation } from "./guard";

function req(): Request {
  return new Request("https://hamloprod.org/api/admin/beats", { method: "POST" });
}

const authed: AdminSessionState = {
  isAuthenticated: true,
  userId: "u1",
  email: "a@x.co",
  role: "ADMIN",
  sessionId: "s1",
  expiresAt: new Date(Date.now() + 3600_000),
  shouldRefresh: false,
};

const anon: AdminSessionState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  role: null,
  sessionId: null,
  expiresAt: null,
  shouldRefresh: false,
};

test("foreign / missing origin → 403 before the session is even read", async () => {
  let sessionRead = false;
  const guard = await requireAdminMutation(req(), {
    sameOrigin: () => false,
    getSession: async () => {
      sessionRead = true;
      return authed;
    },
  });
  assert.equal(guard.ok, false);
  if (!guard.ok) assert.equal(guard.status, 403);
  assert.equal(sessionRead, false);
});

test("no session → 401", async () => {
  const guard = await requireAdminMutation(req(), { sameOrigin: () => true, getSession: async () => anon });
  assert.equal(guard.ok, false);
  if (!guard.ok) assert.equal(guard.status, 401);
});

test("session read failure → 503", async () => {
  const guard = await requireAdminMutation(req(), {
    sameOrigin: () => true,
    getSession: async () => {
      throw new Error("db down");
    },
  });
  assert.equal(guard.ok, false);
  if (!guard.ok) assert.equal(guard.status, 503);
});

test("same origin + admin session → ok with userId + role", async () => {
  const guard = await requireAdminMutation(req(), { sameOrigin: () => true, getSession: async () => authed });
  assert.equal(guard.ok, true);
  if (guard.ok) assert.deepEqual(guard.context, { userId: "u1", role: "ADMIN" });
});
