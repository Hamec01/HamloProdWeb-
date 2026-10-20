/**
 * Stripe webhook signature check without the SDK.
 * Header `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>…]`; the signed payload is
 * `${t}.${rawBody}` with HMAC-SHA256 under the endpoint's `whsec_…` secret.
 * See https://docs.stripe.com/webhooks#verify-manually
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SECONDS = 300;

export function signStripePayload(payload: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  options: { toleranceSeconds?: number; nowSeconds?: number } = {},
): boolean {
  if (!header || !secret) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [name, value] = part.split("=", 2).map((s) => s?.trim());
    if (name === "t" && value && /^\d+$/.test(value)) timestamp = Number(value);
    else if (name === "v1" && value) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return false;

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) return false;

  const expected = Buffer.from(signStripePayload(payload, secret, timestamp), "hex");
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
