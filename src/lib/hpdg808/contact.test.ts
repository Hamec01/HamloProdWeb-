import assert from "node:assert/strict";
import { test } from "node:test";
import { hpdg808DownloadSchema } from "./contact";

test("free download accepts missing or blank email", () => {
  for (const body of [{}, { email: "" }, { email: "   ", locale: "ru" }]) {
    assert.equal(hpdg808DownloadSchema.safeParse(body).success, true);
  }
});

test("optional contact is normalised for deduplication", () => {
  assert.deepEqual(hpdg808DownloadSchema.parse({ email: "  Producer@Example.com  ", locale: "ru" }), {
    email: "producer@example.com", locale: "ru",
  });
});

test("invalid contact data is rejected, not silently saved", () => {
  for (const body of [{ email: "not-an-email" }, { email: 123 }, { email: null }, { email: "a".repeat(255) + "@example.com" }, { locale: "unknown" }]) {
    assert.equal(hpdg808DownloadSchema.safeParse(body).success, false);
  }
});
