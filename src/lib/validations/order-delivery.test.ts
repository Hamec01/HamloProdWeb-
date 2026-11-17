import test from "node:test";
import assert from "node:assert/strict";
import { orderDeliverySchema } from "./order-delivery";

test("delivery accepts a persistent HTTPS download/share link and supports clearing it", () => {
  assert.equal(orderDeliverySchema.parse({ url: "  https://example.com/beat.mp3  " }).url, "https://example.com/beat.mp3");
  assert.equal(orderDeliverySchema.parse({ url: "" }).url, "");
});

test("invalid or executable delivery links fail validation without throwing", () => {
  for (const url of ["not a link", "javascript:alert(1)", "http://example.com/file", "data:audio/mp3;base64,YQ==", "https://user:password@example.com/beat.mp3", "x".repeat(4001)]) assert.equal(orderDeliverySchema.safeParse({ url }).success, false);
});
