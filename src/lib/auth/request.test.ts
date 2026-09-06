import test from "node:test";
import assert from "node:assert/strict";
import { clientInfo, clientIp } from "./request";

function req(headers: Record<string, string>): Request {
  return new Request("https://hamloprod.org/api/admin/auth/login", { method: "POST", headers });
}

test("trusts x-vercel-forwarded-for, then x-real-ip", () => {
  assert.equal(clientIp(req({ "x-vercel-forwarded-for": "9.9.9.9, 10.0.0.1" }), {}), "9.9.9.9");
  assert.equal(clientIp(req({ "x-real-ip": "8.8.8.8" }), {}), "8.8.8.8");
  assert.equal(
    clientIp(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }), {}),
    "1.1.1.1",
  );
});

test("ignores a client-supplied x-forwarded-for in production", () => {
  assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6" }), { NODE_ENV: "production" }), "unknown");
});

test("accepts x-forwarded-for outside production, or with TRUST_FORWARDED_FOR", () => {
  assert.equal(clientIp(req({ "x-forwarded-for": "6.6.6.6" }), { NODE_ENV: "development" }), "6.6.6.6");
  assert.equal(
    clientIp(req({ "x-forwarded-for": "6.6.6.6" }), { NODE_ENV: "production", TRUST_FORWARDED_FOR: "true" }),
    "6.6.6.6",
  );
});

test("falls back to 'unknown' and rejects garbage", () => {
  assert.equal(clientIp(req({}), { NODE_ENV: "production" }), "unknown");
  assert.equal(clientIp(req({ "x-real-ip": "x".repeat(60) }), {}), "unknown");
});

test("the Host header is never consulted", () => {
  assert.equal(clientIp(req({ host: "1.2.3.4", "x-forwarded-host": "5.6.7.8" }), { NODE_ENV: "production" }), "unknown");
});

test("clientInfo carries ip + userAgent", () => {
  const info = clientInfo(req({ "x-real-ip": "3.3.3.3", "user-agent": "smoke" }));
  assert.equal(info.ip, "3.3.3.3");
  assert.equal(info.userAgent, "smoke");
});
