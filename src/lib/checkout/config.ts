/**
 * Paid-checkout kill switch. Server-only.
 *
 * Paid checkout — Order creation/mutation via `/api/checkout`, Lava payment
 * creation via `/api/payments/create`, and checkout contract preview/PDF
 * generation — is enabled ONLY when `PAID_CHECKOUT_ENABLED` is exactly `"true"`.
 * Default (unset, or any other value) is OFF: online payments are deferred until
 * a payment provider is connected (see roadmap "payment systems + contract
 * generation" backlog milestone).
 *
 * When off:
 *   - no Order row is created or changed;
 *   - Lava is never contacted;
 *   - no new checkout contract snapshot / rights PDF is generated;
 *   - the routes above return a controlled 503 with `code: PAID_CHECKOUT_DISABLED`;
 *   - imported orders and purchase history stay readable;
 *   - the separate free loyalty flow (`/api/beats/[id]/purchase`) is unaffected —
 *     it records a purchase + loyalty points and never touches an Order or Lava.
 *
 * The Lava integration code is intentionally kept in place for when the flag flips.
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
