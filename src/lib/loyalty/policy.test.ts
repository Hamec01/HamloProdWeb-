import test from "node:test";
import assert from "node:assert/strict";
import { getDiscountPercent, POINTS_PER_FREE_BEAT, POINTS_PER_PURCHASE } from "@/lib/loyalty";

test("four paid purchases earn one free beat; no partial or perpetual discount", () => {
  assert.equal(POINTS_PER_PURCHASE, 25);
  assert.equal(POINTS_PER_FREE_BEAT, 100);
  for (const value of [0, 1, 4, 25, 50, 75, 99]) assert.equal(getDiscountPercent(value), 0);
  assert.equal(getDiscountPercent(100), 100);
  assert.equal(getDiscountPercent(100 - POINTS_PER_FREE_BEAT), 0);
});
