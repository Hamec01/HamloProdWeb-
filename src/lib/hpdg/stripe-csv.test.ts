import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseStripePayments } from "./stripe-csv";

const EXPORT = [
  '﻿id,Created date (UTC),Amount,Amount Refunded,Currency,Description,Status,Customer ID,Customer Email',
  'py_1,2026-10-10 12:00:00,9.99,0.00,usd,"HPDG, beta",Paid,cus_1,Buyer@Example.com',
  'py_2,2026-10-11 12:00:00,9.99,9.99,usd,,Refunded,cus_2,b@example.com',
  'py_3,2026-10-12 12:00:00,9.99,0.00,usd,,Failed,,c@example.com',
  'py_4,2026-10-13 12:00:00,9.99,0.00,usd,,Paid,,',
  '',
].join("\r\n");

test("quoted cells, escaped quotes, CRLF and BOM", () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n'), [["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
});

test("paid, non-refunded rows with an email are eligible; others say why not", () => {
  const { payments, error } = parseStripePayments(EXPORT);
  assert.equal(error, null);
  assert.deepEqual(payments.map((p) => [p.paymentId, p.email, p.eligible, p.reason]), [
    ["py_1", "buyer@example.com", true, null],
    ["py_2", "b@example.com", false, "status: Refunded"],
    ["py_3", "c@example.com", false, "status: Failed"],
    ["py_4", "", false, "no email"],
  ]);
  assert.equal(payments[0].customerId, "cus_1");
  assert.equal(payments[0].description, "HPDG, beta");
  assert.equal(payments[0].currency, "USD");
});

test("email found in any column when there is no email header; refunds caught by amount", () => {
  const { payments } = parseStripePayments("id,Amount Refunded,Billing\npi_9,1.00,x@y.io\npi_8,0,z@y.io");
  assert.deepEqual(payments.map((p) => [p.email, p.reason]), [["x@y.io", "refunded"], ["z@y.io", null]]);
});

test("missing id column or empty file → error", () => {
  assert.match(parseStripePayments("email\na@b.co").error ?? "", /id/);
  assert.match(parseStripePayments("").error ?? "", /no data/);
});
