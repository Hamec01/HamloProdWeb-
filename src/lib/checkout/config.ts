/**
 * Online Stripe checkout is enabled only with an explicit flag and both server
 * credentials. Contact requests, accepted contract previews, already paid PDF
 * downloads and 100-point redemption remain available independently of Stripe.
 * The legacy Lava configuration helpers are retained for imported integrations.
 */

export type EnvSource = Record<string, string | undefined>;

/** Response `code` for every paid-checkout endpoint while the flag is off. */
export const PAID_CHECKOUT_DISABLED_CODE = "PAID_CHECKOUT_DISABLED" as const;

export function isPaidCheckoutEnabled(env: EnvSource = process.env): boolean {
  return (env.PAID_CHECKOUT_ENABLED ?? "").trim().toLowerCase() === "true";
}

export type PaidCheckoutDisabled = {
  status: 503;
  body: { error: string; code: typeof PAID_CHECKOUT_DISABLED_CODE };
};

/** The controlled 503 payload for a disabled paid-checkout endpoint. */
export function paidCheckoutDisabledResponse(): PaidCheckoutDisabled {
  return {
    status: 503,
    body: { error: "Online payments are temporarily unavailable.", code: PAID_CHECKOUT_DISABLED_CODE },
  };
}

/** Contact requests and issued PDFs remain available while online payments are
 * disabled. Only new Stripe payments require both the flag and a secret key. */
export function getBeatCheckoutProvider(locale: "ru" | "en", env: EnvSource = process.env): "stripe" | "contact" {
  return locale === "en" && isBeatStripeReady(env) ? "stripe" : "contact";
}

export function isBeatStripeReady(env: EnvSource = process.env) {
  return isPaidCheckoutEnabled(env) && Boolean(env.STRIPE_SECRET_KEY?.trim()) && Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
}
