import test from "node:test";
import assert from "node:assert/strict";
import { isPaidCheckoutEnabled, PAID_CHECKOUT_DISABLED_CODE, paidCheckoutDisabledResponse } from "./config";

test("paid checkout is disabled by default (unset)", () => {
  assert.equal(isPaidCheckoutEnabled({}), false);
});

test("only the exact string \"true\" (any case, trimmed) enables it", () => {
  assert.equal(isPaidCheckoutEnabled({ PAID_CHECKOUT_ENABLED: "true" }), true);
  assert.equal(isPaidCheckoutEnabled({ PAID_CHECKOUT_ENABLED: "TRUE" }), true);
  assert.equal(isPaidCheckoutEnabled({ PAID_CHECKOUT_ENABLED: "  true  " }), true);
});

test("every other value is disabled (fail closed)", () => {
  for (const v of ["", "false", "FALSE", "1", "0", "yes", "on", "enabled", "t", "y", " ", "truthy"]) {
    assert.equal(isPaidCheckoutEnabled({ PAID_CHECKOUT_ENABLED: v }), false, `value ${JSON.stringify(v)}`);
  }
});

test("the disabled response is a controlled 503 with the documented code (no 500)", () => {
  const r = paidCheckoutDisabledResponse();
  assert.equal(r.status, 503);
  assert.equal(r.body.code, PAID_CHECKOUT_DISABLED_CODE);
  assert.equal(r.body.code, "PAID_CHECKOUT_DISABLED");
  assert.ok(typeof r.body.error === "string" && r.body.error.length > 0);
  // never leaks anything sensitive
  assert.doesNotMatch(JSON.stringify(r.body), /LAVA|SESSION_SECRET|postgres|\$argon2/i);
});
