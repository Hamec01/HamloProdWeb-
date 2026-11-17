export const POINTS_PER_PURCHASE = 25;
export const POINTS_PER_FREE_BEAT = 100;

export function getDiscountPercent(points: number) {
  return points >= POINTS_PER_FREE_BEAT ? 100 : 0;
}

export function getLoyaltyStatus(points: number) {
  return { points, discountPercent: getDiscountPercent(points), nextThreshold: points < POINTS_PER_FREE_BEAT ? POINTS_PER_FREE_BEAT : null, pointsPerPurchase: POINTS_PER_PURCHASE, freeBeatCost: POINTS_PER_FREE_BEAT };
}
