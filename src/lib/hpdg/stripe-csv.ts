/**
 * Parse a Stripe Dashboard payments export (Payments → Export → CSV) into
 * candidate buyers for HPDG keys. Pure, browser-safe: the CSV never leaves the
 * admin's browser — only the chosen { email, paymentId, customerId } rows are sent.
 *
 * Column names differ between export presets, so columns are found by header
 * name; a row is a paid purchase when its status says so and nothing was refunded.
 */

export type StripePayment = {
  paymentId: string;
  email: string;
  customerId: string | null;
  amount: string;
  currency: string;
  created: string;
  description: string;
  status: string;
  eligible: boolean;
  reason: string | null;
};

const EMAIL_RE = /^[^\s@,;"]+@[^\s@,;"]+\.[^\s@,;"]+$/;
const PAID = new Set(["paid", "succeeded", "captured", "complete", "completed"]);

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

export function parseStripePayments(text: string): { payments: StripePayment[]; error: string | null } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { payments: [], error: "The CSV has no data rows." };
  const [headers, ...data] = rows;
  const col = {
    id: findColumn(headers, ["id", "payment id", "paymentintent id", "payment intent id", "charge id"]),
    email: findColumn(headers, ["customer email", "email", "receipt email", "billing email", "customer_email", "billing details email"]),
    customer: findColumn(headers, ["customer id", "customer"]),
    amount: findColumn(headers, ["amount", "converted amount"]),
    refunded: findColumn(headers, ["amount refunded", "refunded amount"]),
    currency: findColumn(headers, ["currency"]),
    created: findColumn(headers, ["created date (utc)", "created (utc)", "created", "created date"]),
    description: findColumn(headers, ["description"]),
    status: findColumn(headers, ["status"]),
  };
  if (col.id < 0) return { payments: [], error: 'No "id" column. Export payments from Stripe Dashboard → Payments → Export.' };

  const at = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
  const payments = data.map((row): StripePayment => {
    const email = (at(row, col.email) || row.map((v) => v.trim()).find((v) => EMAIL_RE.test(v)) || "").toLowerCase();
    const status = at(row, col.status);
    const refunded = Number.parseFloat(at(row, col.refunded).replace(",", ".")) || 0;
    let reason: string | null = null;
    if (!at(row, col.id)) reason = "no payment id";
    else if (!EMAIL_RE.test(email)) reason = "no email";
    else if (col.status >= 0 && !PAID.has(status.toLowerCase())) reason = `status: ${status || "empty"}`;
    else if (refunded > 0) reason = "refunded";
    return {
      paymentId: at(row, col.id),
      email,
      customerId: at(row, col.customer) || null,
      amount: at(row, col.amount),
      currency: at(row, col.currency).toUpperCase(),
      created: at(row, col.created),
      description: at(row, col.description),
      status,
      eligible: reason === null,
      reason,
    };
  });
  return { payments, error: null };
}
