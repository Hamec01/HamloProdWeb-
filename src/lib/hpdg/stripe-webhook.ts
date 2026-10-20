/**
 * Stripe → HPDG license keys. Pure decision logic; every side effect is a port.
 *
 * checkout.session.completed (paid, from an HPDG Payment Link):
 *   record the session once → key (the buyer's active key, or a new one) → email
 *   with an idempotency key → mark emailed. A retried event after the email was
 *   sent is a no-op; a failure throws so the route answers 500 and Stripe retries.
 * charge.refunded (full refund): revoke the key this payment created.
 * Anything else: 200 "ignored" (donations, other products, other events).
 */

export type StripeEvent = { id?: string; type?: string; data?: { object?: Record<string, unknown> } };

export type CheckoutRecord = { sessionId: string; emailedAt: Date | null };

export type StripeWebhookPorts = {
  /** Payment Link ids (plink_…) that sell HPDG. */
  paymentLinkIds: string[];
  findCheckout(sessionId: string): Promise<CheckoutRecord | null>;
  recordCheckout(input: { sessionId: string; paymentIntentId: string | null; email: string }): Promise<void>;
  assignKey(input: { sessionId: string; email: string; paymentIntentId: string | null; customerId: string | null }): Promise<{ key: string; created: boolean }>;
  sendKeyEmail(input: { email: string; key: string; idempotencyKey: string }): Promise<void>;
  markEmailed(sessionId: string): Promise<void>;
  revokeForPayment(input: { chargeId: string; paymentIntentId: string | null }): Promise<string[]>;
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ok = (body: Record<string, unknown>): WebhookResult => ({ status: 200, body: { received: true, ...body } });
const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export async function handleStripeEvent(event: StripeEvent, ports: StripeWebhookPorts): Promise<WebhookResult> {
  const object = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    const sessionId = str(object.id);
    if (!sessionId) return ok({ ignored: "no_session_id" });
    if (!ports.paymentLinkIds.includes(str(object.payment_link) ?? "")) return ok({ ignored: "not_hpdg" });
    if (object.payment_status !== "paid") return ok({ ignored: "not_paid" });

    const details = (object.customer_details ?? {}) as Record<string, unknown>;
    const email = (str(details.email) ?? str(object.customer_email) ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return ok({ ignored: "no_email" });

    const existing = await ports.findCheckout(sessionId);
    if (existing?.emailedAt) return ok({ duplicate: true });

    const paymentIntentId = str(object.payment_intent);
    if (!existing) await ports.recordCheckout({ sessionId, paymentIntentId, email });
    const { key, created } = await ports.assignKey({ sessionId, email, paymentIntentId, customerId: str(object.customer) });
    await ports.sendKeyEmail({ email, key, idempotencyKey: `hpdg-key-${sessionId}` });
    await ports.markEmailed(sessionId);
    return ok({ issued: true, newKey: created });
  }

  if (event.type === "charge.refunded") {
    const chargeId = str(object.id);
    if (!chargeId) return ok({ ignored: "no_charge_id" });
    if (object.refunded !== true) return ok({ ignored: "partial_refund" });
    const revoked = await ports.revokeForPayment({ chargeId, paymentIntentId: str(object.payment_intent) });
    return ok({ revoked: revoked.length });
  }

  return ok({ ignored: "event_type" });
}
