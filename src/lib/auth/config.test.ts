import test from "node:test";
import assert from "node:assert/strict";
import { AuthConfigError, getSessionSecret, isAuthConfigured } from "./config";

test("accepts a 32+ byte secret (hex, base64url, or raw text)", () => {
  const hex = "a".repeat(64); // 32 bytes
  assert.equal(getSessionSecret({ SESSION_SECRET: hex }), hex);

  const b64 = Buffer.alloc(48, 7).toString("base64url");
  assert.equal(getSessionSecret({ SESSION_SECRET: b64 }), b64);

  const raw = "this is a long enough passphrase of many many chars";
  assert.equal(getSessionSecret({ SESSION_SECRET: raw }), raw);
});

test("rejects missing / short secrets and never echoes the value", () => {
  assert.throws(() => getSessionSecret({}), AuthConfigError);
  assert.throws(() => getSessionSecret({ SESSION_SECRET: "  " }), AuthConfigError);

  try {
    getSessionSecret({ SESSION_SECRET: "deadbeef" });
    assert.fail("expected throw");
  } catch (error) {
    assert.ok(error instanceof AuthConfigError);
    assert.doesNotMatch(error.message, /deadbeef/);
    assert.match(error.message, /SESSION_SECRET/);
  }
});

test("isAuthConfigured", () => {
  assert.equal(isAuthConfigured({}), false);
  assert.equal(isAuthConfigured({ SESSION_SECRET: "a".repeat(64) }), true);
});
