import test from "node:test";
import assert from "node:assert/strict";
import { adminCookieName, adminCookieOptions, ALL_ADMIN_COOKIE_NAMES, clearedAdminCookieOptions } from "./cookies";

test("cookie name is __Host- prefixed in production only", () => {
  assert.equal(adminCookieName(true), "__Host-hp_admin_session");
  assert.equal(adminCookieName(false), "hp_admin_session");
  assert.deepEqual([...ALL_ADMIN_COOKIE_NAMES], ["__Host-hp_admin_session", "hp_admin_session"]);
});

test("cookie options: httpOnly, SameSite=Lax, Path=/, no Domain, Secure in prod", () => {
  const expires = new Date(Date.now() + 8 * 3600 * 1000);
  const opts = adminCookieOptions(expires, true);

  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
  assert.equal(opts.secure, true);
  assert.ok(!("domain" in opts));
  assert.ok(opts.maxAge > 8 * 3600 - 5 && opts.maxAge <= 8 * 3600);
  assert.equal(opts.expires.getTime(), expires.getTime());

  assert.equal(adminCookieOptions(expires, false).secure, false);
});

test("cleared options expire immediately", () => {
  const opts = clearedAdminCookieOptions(true);
  assert.equal(opts.maxAge, 0);
  assert.equal(opts.expires.getTime(), 0);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.path, "/");
});
