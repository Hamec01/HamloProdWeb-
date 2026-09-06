import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPasswordPolicy,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
  WeakPasswordError,
} from "./password";

test("hashPassword produces an argon2id hash that verifies", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "correct horse battery staple"), true);
  assert.equal(await verifyPassword(hash, "wrong password entirely"), false);
});

test("policy: min 12, max 128", () => {
  assert.throws(() => assertPasswordPolicy("short"), WeakPasswordError);
  assert.throws(() => assertPasswordPolicy("x".repeat(MIN_PASSWORD_LENGTH - 1)), WeakPasswordError);
  assert.doesNotThrow(() => assertPasswordPolicy("x".repeat(MIN_PASSWORD_LENGTH)));
  assert.throws(() => assertPasswordPolicy("x".repeat(MAX_PASSWORD_LENGTH + 1)), WeakPasswordError);
});

test("hashPassword enforces the policy", async () => {
  await assert.rejects(hashPassword("tooshort"), WeakPasswordError);
});

test("verifyPassword returns false (never throws) for malformed hashes", async () => {
  assert.equal(await verifyPassword("", "whatever-password"), false);
  assert.equal(await verifyPassword("not-a-hash", "whatever-password"), false);
  assert.equal(await verifyPassword("$argon2id$broken", "whatever-password"), false);
  assert.equal(await verifyPassword("$2b$10$bcryptnotargon", "whatever-password"), false);
});

test("verifyPassword rejects empty / over-long candidate passwords", async () => {
  const hash = await hashPassword("a valid admin password");
  assert.equal(await verifyPassword(hash, ""), false);
  assert.equal(await verifyPassword(hash, "x".repeat(MAX_PASSWORD_LENGTH + 1)), false);
});

test("the dummy hash is a real argon2id hash (constant-time fallback)", async () => {
  assert.match(DUMMY_PASSWORD_HASH, /^\$argon2id\$v=19\$m=19456/);
  assert.equal(await verifyPassword(DUMMY_PASSWORD_HASH, "anything at all here"), false);
});
