import { createHmac, timingSafeEqual } from "node:crypto";

type StripeSessionResponse = {
  id?: unknown;
  url?: unknown;
  error?: { message?: unknown };
};

export async function createStripeCheckoutSession(input: {
  secretKey: string;
  orderId: string;
  beatTitle: string;
  buyerEmail: string;
  amountUsd: number;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!Number.isSafeInteger(input.amountUsd) || input.amountUsd < 1 || input.amountUsd > Math.floor(Number.MAX_SAFE_INTEGER / 100)) {
    throw new Error("STRIPE_INVALID_AMOUNT");
  }

  const form = new URLSearchParams({
    mode: "payment",
    customer_email: input.buyerEmail,
    client_reference_id: input.orderId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[orderId]": input.orderId,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(input.amountUsd * 100),
    "line_items[0][price_data][product_data][name]": input.beatTitle,
    "line_items[0][quantity]": "1",
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `hamloprod-order-${input.orderId}`,
    },
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as StripeSessionResponse | null;
  const sessionId = typeof payload?.id === "string" ? payload.id : "";
  const paymentUrl = typeof payload?.url === "string" ? payload.url : "";

  if (!response.ok || !sessionId || !paymentUrl) {
    throw new Error("STRIPE_REQUEST_FAILED");
  }

  return { sessionId, paymentUrl };
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string;
  nowSeconds?: number;
}) {
  const fields = (input.signatureHeader ?? "").split(",").map((part) => part.trim().split("=", 2));
  const timestampText = fields.find(([key]) => key === "t")?.[1];
  const timestamp = timestampText ? Number(timestampText) : Number.NaN;
  const signatures = fields.filter(([key]) => key === "v1").map(([, value]) => value);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || signatures.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", input.webhookSecret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest();

  return signatures.some((signature) => {
    if (!/^[\da-f]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
