import { NextResponse } from "next/server";
import { buildKeyEmail, getMailConfig, sendEmail } from "@/lib/hpdg/key-email";
import { createStripeWebhookPorts, hpdgPaymentLinkIds } from "@/lib/hpdg/postgres";
import { handleStripeEvent, type StripeEvent } from "@/lib/hpdg/stripe-webhook";
import { verifyStripeSignature } from "@/lib/stripe/webhook-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe event destination "HPDG license" (checkout.session.completed, charge.refunded).
 * 400 bad signature · 503 not configured (Stripe keeps retrying for up to 3 days) ·
 * 500 temporary failure (retry) · 200 handled or ignored.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const paymentLinkIds = hpdgPaymentLinkIds();
  const payload = await request.text();

  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" && paymentLinkIds.length === 0) {
    return NextResponse.json({ error: "HPDG_STRIPE_PAYMENT_LINK_IDS is not set" }, { status: 503 });
  }

  try {
    const ports = createStripeWebhookPorts({
      paymentLinkIds,
      async sendKeyEmail({ email, key, idempotencyKey }) {
        await sendEmail(email, buildKeyEmail({ key }), getMailConfig(), { idempotencyKey });
      },
    });
    const result = await handleStripeEvent(event, ports);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[stripe-webhook]", event.type, event.id, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "temporary failure" }, { status: 500 });
  }
}
