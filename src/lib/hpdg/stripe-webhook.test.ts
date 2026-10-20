import test from "node:test";
import assert from "node:assert/strict";
import { handleStripeEvent, type StripeWebhookPorts } from "./stripe-webhook";

const LINK = "plink_hpdg";

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", payment_link: LINK, payment_status: "paid", payment_intent: "pi_1", customer: null, customer_details: { email: "Buyer@Example.com" }, ...overrides } },
  };
}

function fake(options: { failEmail?: number } = {}) {
  const state = {
    checkouts: new Map<string, { emailedAt: Date | null; key: string | null }>(),
    emails: [] as { email: string; key: string; idempotencyKey: string }[],
    revoked: [] as unknown[],
    emailFailures: options.failEmail ?? 0,
  };
  const ports: StripeWebhookPorts = {
    paymentLinkIds: [LINK],
    findCheckout: async (id) => (state.checkouts.has(id) ? { sessionId: id, emailedAt: state.checkouts.get(id)!.emailedAt } : null),
    recordCheckout: async ({ sessionId }) => { state.checkouts.set(sessionId, { emailedAt: null, key: null }); },
    assignKey: async ({ sessionId }) => {
      const row = state.checkouts.get(sessionId)!;
      if (row.key) return { key: row.key, created: false };
      row.key = "HPDG-AAAA-BBBB-CCCC-DDDD";
      return { key: row.key, created: true };
    },
    sendKeyEmail: async (input) => {
      if (state.emailFailures > 0) { state.emailFailures -= 1; throw new Error("resend down"); }
      state.emails.push(input);
    },
    markEmailed: async (id) => { state.checkouts.get(id)!.emailedAt = new Date(); },
    revokeForPayment: async (input) => { state.revoked.push(input); return ["k1"]; },
  };
  return { ports, state };
}

test("paid HPDG checkout → one key, one email (lower-cased address, idempotency key per session)", async () => {
  const { ports, state } = fake();
  const result = await handleStripeEvent(session(), ports);
  assert.deepEqual(result, { status: 200, body: { received: true, issued: true, newKey: true } });
  assert.deepEqual(state.emails, [{ email: "buyer@example.com", key: "HPDG-AAAA-BBBB-CCCC-DDDD", idempotencyKey: "hpdg-key-cs_1" }]);
});

test("a retried event after the email went out does nothing", async () => {
  const { ports, state } = fake();
  await handleStripeEvent(session(), ports);
  assert.deepEqual((await handleStripeEvent(session(), ports)).body, { received: true, duplicate: true });
  assert.equal(state.emails.length, 1);
});

test("email failure throws (Stripe retries) and the retry reuses the same key", async () => {
  const { ports, state } = fake({ failEmail: 1 });
  await assert.rejects(handleStripeEvent(session(), ports), /resend down/);
  const retry = await handleStripeEvent(session(), ports);
  assert.equal(retry.body.newKey, false);
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].key, "HPDG-AAAA-BBBB-CCCC-DDDD");
});

test("donations / other links, unpaid sessions and missing email are ignored", async () => {
  for (const [overrides, reason] of [
    [{ payment_link: "plink_donate" }, "not_hpdg"],
    [{ payment_link: null }, "not_hpdg"],
    [{ payment_status: "unpaid" }, "not_paid"],
    [{ customer_details: {} }, "no_email"],
  ] as const) {
    const { ports, state } = fake();
    assert.deepEqual((await handleStripeEvent(session(overrides), ports)).body, { received: true, ignored: reason });
    assert.equal(state.emails.length, 0);
  }
});

test("full refund revokes; partial refund and other events are ignored", async () => {
  const { ports, state } = fake();
  const refund = (refunded: boolean) => ({ type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_1", refunded } } });
  assert.deepEqual((await handleStripeEvent(refund(true), ports)).body, { received: true, revoked: 1 });
  assert.deepEqual(state.revoked, [{ chargeId: "ch_1", paymentIntentId: "pi_1" }]);
  assert.deepEqual((await handleStripeEvent(refund(false), ports)).body, { received: true, ignored: "partial_refund" });
  assert.deepEqual((await handleStripeEvent({ type: "invoice.paid", data: { object: {} } }, ports)).body, { received: true, ignored: "event_type" });
});
