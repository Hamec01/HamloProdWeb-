import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beatStripeAvailability } from "./stripe-availability";
import { StripePurchaseOption } from "@/components/beats/stripe-purchase-option";

test("Stripe remains visible with a missing-file explanation while payment stays disabled", () => {
  const status = beatStripeAvailability(true, 20, false);
  assert.equal(status.available, false); assert.equal(status.reason, "file");
  const html = renderToStaticMarkup(createElement(StripePurchaseOption, { href: "/checkout/test?payment=stripe", priceUsd: 20, available: status.available, reason: status.reason, locale: "ru" }));
  assert.ok(html.includes("Купить через Stripe")); assert.ok(html.includes("$20"));
  assert.match(html, /<button[^>]*disabled/); assert.ok(html.includes("Файл бита"));
  assert.ok(!html.includes('href="/checkout/test?payment=stripe"'), "missing delivery must not expose an actionable payment link");
});

test("Stripe activates only with credentials, a positive price and a prepared file", () => {
  assert.equal(beatStripeAvailability(false, 20, true).reason, "disabled");
  assert.equal(beatStripeAvailability(true, 0, true).reason, "price");
  assert.deepEqual(beatStripeAvailability(true, 20, true), { available: true, reason: null });
});
