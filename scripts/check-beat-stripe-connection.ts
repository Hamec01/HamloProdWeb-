import { randomUUID } from "node:crypto";
import { createStripeCheckoutSession, retrieveStripeCheckoutSession } from "../src/lib/payments/stripe";

/** Opt-in deployment check; no key, checkout URL or customer data is printed.
 * Creates one unpaid, unadvertised checkout and immediately expires it. */
async function main() {
  if (process.env.STRIPE_CONNECTION_CHECK !== "true") return;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) throw Error("Stripe server credentials are missing.");
  const checkId = `connection-check-${randomUUID()}`;
  const result = await createStripeCheckoutSession({ secretKey, orderId: checkId, beatTitle: "HamloProd connection check — no purchase", buyerEmail: "stripe-check@example.invalid", amountUsd: 1, successUrl: "https://hamloprod.org/profile", cancelUrl: "https://hamloprod.org/profile", expiresAt: Math.floor(Date.now() / 1000) + 3600, integrationCheck: true });
  try {
    const session = await retrieveStripeCheckoutSession(secretKey, result.sessionId);
    if (session.payment_status !== "unpaid" || session.status !== "open") throw Error("Unexpected Stripe checkout check state.");
  } finally {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(result.sessionId)}/expire`, { method: "POST", headers: { Authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error(`Stripe check checkout could not be expired (${response.status}).`);
    const expired = await response.json();
    if (expired.status !== "expired") throw Error("Stripe check checkout expiry was not confirmed.");
  }
  console.log("[stripe-check] Checkout creation, retrieval and expiry passed. No payment was taken.");
}
main().catch((error) => { const code = error instanceof Error && /^STRIPE_[A-Z_]+$/.test(error.message) ? error.message : "CHECK_FAILED"; console.error(`[stripe-check] ${code}: verify the Stripe key and Checkout Sessions permissions. No payment was taken.`); process.exitCode = 1; });
