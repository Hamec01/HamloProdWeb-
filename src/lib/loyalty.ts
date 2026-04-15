export function getDiscountPercent(points: number) {
  if (points >= 4) {
    return 100;
  }

  if (points >= 2) {
    return 50;
  }

  return 0;
}