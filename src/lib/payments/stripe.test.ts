import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createStripeCheckoutSession, verifyStripeWebhookSignature } from "./stripe";

test("Stripe Checkout Session uses the fixed order amount, metadata and idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ id: "cs_test_123", url: "https://checkout.stripe.test/session" });
  };

  try {
    const result = await createStripeCheckoutSession({
      secretKey: "sk_test_only",
      orderId: "order-123",
      beatTitle: "Night Drive",
      buyerEmail: "artist@example.com",
      amountUsd: 125,
      successUrl: "https://hamloprod.com/profile?payment=success",
      cancelUrl: "https://hamloprod.com/checkout/payment/order-123",
    });

    assert.equal(requestUrl, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(result.sessionId, "cs_test_123");
    assert.equal(result.paymentUrl, "https://checkout.stripe.test/session");
    assert.equal(new Headers(requestInit?.headers).get("Idempotency-Key"), "hamloprod-order-order-123");

    const form = new URLSearchParams(String(requestInit?.body));
    assert.equal(form.get("line_items[0][price_data][unit_amount]"), "12500");
    assert.equal(form.get("metadata[orderId]"), "order-123");
    assert.equal(form.get("line_items[0][price_data][product_data][name]"), "Night Drive");
    assert.equal(form.get("customer_email"), "artist@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe Checkout rejects zero, fractional and unsafe amounts", async () => {
  for (const amountUsd of [0, -1, 1.5, Math.floor(Number.MAX_SAFE_INTEGER / 100) + 1]) {
    await assert.rejects(
      createStripeCheckoutSession({
        secretKey: "sk_test_only",
        orderId: "order-123",
        beatTitle: "Night Drive",
        buyerEmail: "artist@example.com",
        amountUsd,
        successUrl: "https://hamloprod.com/profile",
        cancelUrl: "https://hamloprod.com/checkout",
      }),
      { message: "STRIPE_INVALID_AMOUNT" },
    );
  }
});

test("Stripe webhook signature accepts a current v1 signature only", () => {
  const rawBody = '{"type":"checkout.session.completed"}';
  const secret = "whsec_test_secret";
  const timestamp = 1_798_000_000;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  assert.equal(verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${signature}`,
    webhookSecret: secret,
    nowSeconds: timestamp,
  }), true);
  assert.equal(verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`,
    webhookSecret: secret,
    nowSeconds: timestamp,
  }), true);
  assert.equal(verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${signature}`,
    webhookSecret: "wrong_secret",
    nowSeconds: timestamp,
  }), false);
  assert.equal(verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp - 301},v1=${signature}`,
    webhookSecret: secret,
    nowSeconds: timestamp,
  }), false);
  assert.equal(verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: null,
    webhookSecret: secret,
    nowSeconds: timestamp,
  }), false);
});
