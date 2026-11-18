export type StripeUnavailableReason = "file" | "price" | "disabled";

export function beatStripeAvailability(configured: boolean, priceUsd: number, hasDelivery: boolean): { available: boolean; reason: StripeUnavailableReason | null } {
  if (!configured) return { available: false, reason: "disabled" };
  if (priceUsd < 1) return { available: false, reason: "price" };
  if (!hasDelivery) return { available: false, reason: "file" };
  return { available: true, reason: null };
}
