export const POINTS_PER_PURCHASE = 25;
export const POINTS_PER_FREE_BEAT = 100;

export function getDiscountPercent(points: number) {
  return points >= POINTS_PER_FREE_BEAT ? 100 : 0;
}
