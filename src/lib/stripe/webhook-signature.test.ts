import test from "node:test";
import assert from "node:assert/strict";
import { signStripePayload, verifyStripeSignature } from "./webhook-signature";

const SECRET = "whsec_test";
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';
const NOW = 1_800_000_000;

test("a correct signature within tolerance is accepted (also among several v1 values)", () => {
  const sig = signStripePayload(BODY, SECRET, NOW);
  assert.ok(verifyStripeSignature(BODY, `t=${NOW},v1=${sig}`, SECRET, { nowSeconds: NOW + 10 }));
  assert.ok(verifyStripeSignature(BODY, `t=${NOW},v1=${"0".repeat(64)},v1=${sig}`, SECRET, { nowSeconds: NOW }));
});

test("tampered body, wrong secret, old timestamp or broken header are rejected", () => {
  const sig = signStripePayload(BODY, SECRET, NOW);
  assert.ok(!verifyStripeSignature(BODY + " ", `t=${NOW},v1=${sig}`, SECRET, { nowSeconds: NOW }));
  assert.ok(!verifyStripeSignature(BODY, `t=${NOW},v1=${sig}`, "whsec_other", { nowSeconds: NOW }));
  assert.ok(!verifyStripeSignature(BODY, `t=${NOW},v1=${sig}`, SECRET, { nowSeconds: NOW + 301 }));
  for (const header of [null, "", `v1=${sig}`, `t=${NOW}`, `t=abc,v1=${sig}`, `t=${NOW},v0=${sig}`]) {
    assert.ok(!verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW }), String(header));
  }
  assert.ok(!verifyStripeSignature(BODY, `t=${NOW},v1=${sig}`, "", { nowSeconds: NOW }));
});
