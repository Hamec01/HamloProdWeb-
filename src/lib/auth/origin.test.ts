import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins, isAllowedOrigin, isSameOriginRequest } from "./origin";

function req(headers: Record<string, string>): Request {
  return new Request("https://hamloprod.org/api/admin/auth/login", { method: "POST", headers });
}

test("base allow-list", () => {
  assert.deepEqual(allowedOrigins({}), [
    "https://hamloprod.org",
    "https://www.hamloprod.org",
    "http://localhost:3000",
  ]);
  assert.equal(isAllowedOrigin("https://hamloprod.org", {}), true);
  assert.equal(isAllowedOrigin("https://evil.example", {}), false);
  assert.equal(isAllowedOrigin(null, {}), false);
});

test("extra origins come only from server env, validated", () => {
  const env = { AUTH_EXTRA_ORIGINS: "https://preview-abc.vercel.app, not-a-url , http://localhost:6006" };
  assert.equal(isAllowedOrigin("https://preview-abc.vercel.app", env), true);
  assert.equal(isAllowedOrigin("http://localhost:6006", env), true);
  assert.equal(isAllowedOrigin("not-a-url", env), false);
});

test("isSameOriginRequest requires an allow-listed Origin", () => {
  assert.equal(isSameOriginRequest(req({ origin: "https://hamloprod.org" }), {}), true);
  assert.equal(isSameOriginRequest(req({ origin: "https://attacker.test" }), {}), false);
  assert.equal(isSameOriginRequest(req({}), {}), false);
});

test("isSameOriginRequest falls back to Referer origin when Origin is absent", () => {
  assert.equal(isSameOriginRequest(req({ referer: "https://www.hamloprod.org/admin/login" }), {}), true);
  assert.equal(isSameOriginRequest(req({ referer: "https://phish.test/admin/login" }), {}), false);
  assert.equal(isSameOriginRequest(req({ referer: "::::" }), {}), false);
});
