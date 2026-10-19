import test from "node:test";
import assert from "node:assert/strict";
import { generateLicenseKey, KEY_RE, keysEqual, licenseKeyHash, normalizeLicenseKey } from "./license-key";

test("generated keys have the plugin format and differ", () => {
  const keys = new Set(Array.from({ length: 200 }, () => generateLicenseKey()));
  assert.equal(keys.size, 200);
  for (const key of keys) assert.match(key, KEY_RE);
});

test("all 80 bits are used: zero and all-ones bytes map to the alphabet ends", () => {
  assert.equal(generateLicenseKey(() => Buffer.alloc(10, 0)), "HPDG-0000-0000-0000-0000");
  assert.equal(generateLicenseKey(() => Buffer.alloc(10, 0xff)), "HPDG-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
});

test("normalisation: case, spaces, missing prefix and dashes, O→0, I/L→1", () => {
  assert.equal(normalizeLicenseKey("hpdg-7k3m-2q9x-abcd-ef01"), "HPDG-7K3M-2Q9X-ABCD-EF01");
  assert.equal(normalizeLicenseKey(" 7K3M 2Q9X ABCD EF0I "), "HPDG-7K3M-2Q9X-ABCD-EF01");
  assert.equal(normalizeLicenseKey("HPDG7K3M2Q9XABCDEFOL"), "HPDG-7K3M-2Q9X-ABCD-EF01");
});

test("non-keys are rejected", () => {
  for (const value of ["", "HPDG-7K3M-2Q9X-ABCD", "HPDG-7K3M-2Q9X-ABCD-EF01-0000", "HPDG-7K3M-2Q9X-ABCD-EFU1", "HPDG-7K3M-2Q9X-ABCD-EF0!", 42, null, "x".repeat(100)]) {
    assert.equal(normalizeLicenseKey(value), null, String(value));
  }
});

test("hash is stable per normalised key and comparison is exact", () => {
  assert.equal(licenseKeyHash("HPDG-0000-0000-0000-0000"), licenseKeyHash("HPDG-0000-0000-0000-0000"));
  assert.notEqual(licenseKeyHash("HPDG-0000-0000-0000-0000"), licenseKeyHash("HPDG-0000-0000-0000-0001"));
  assert.ok(keysEqual("HPDG-0000-0000-0000-0000", "HPDG-0000-0000-0000-0000"));
  assert.ok(!keysEqual("HPDG-0000-0000-0000-0000", "HPDG-0000-0000-0000-000"));
});
