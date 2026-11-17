import test from "node:test";
import assert from "node:assert/strict";
import { getBeatCheckoutProvider } from "./config";

test("buyer requests stay available through contact checkout without Stripe credentials", () => {
  assert.equal(getBeatCheckoutProvider("en", {}), "contact");
  assert.equal(getBeatCheckoutProvider("ru", {}), "contact");
  assert.equal(getBeatCheckoutProvider("en", { PAID_CHECKOUT_ENABLED: "true" }), "contact");
});

test("a configured key does not enable Stripe while paid checkout is disabled", () => {
  assert.equal(getBeatCheckoutProvider("en", { STRIPE_SECRET_KEY: "test-key" }), "contact");
  assert.equal(getBeatCheckoutProvider("en", { STRIPE_SECRET_KEY: "test-key", PAID_CHECKOUT_ENABLED: "false" }), "contact");
});

test("Stripe requires explicit enablement and stays out of the Russian contact market", () => {
  const configured = { STRIPE_SECRET_KEY: "test-key", PAID_CHECKOUT_ENABLED: "true" };
  assert.equal(getBeatCheckoutProvider("en", configured), "stripe");
  assert.equal(getBeatCheckoutProvider("ru", configured), "contact");
});
