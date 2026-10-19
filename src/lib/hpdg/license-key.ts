/**
 * HPDG license keys: `HPDG-XXXX-XXXX-XXXX-XXXX`, 16 Crockford base32 characters
 * (80 random bits from `crypto.randomBytes`). Pure — no Prisma import.
 *
 * Normalisation matches the plugin: uppercase, drop spaces / dashes, O→0, I/L→1,
 * optional `HPDG` prefix. Anything that is not exactly 16 alphabet characters
 * afterwards is not a key.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const KEY_BODY_LENGTH = 16;
export const KEY_RE = /^HPDG(-[0-9A-HJKMNP-TV-Z]{4}){4}$/;

function format(body: string): string {
  return `HPDG-${body.match(/.{4}/g)!.join("-")}`;
}

/** 80 bits → 16 symbols of 5 bits each, no modulo bias. */
export function generateLicenseKey(random: (size: number) => Buffer = randomBytes): string {
  const bytes = random(10);
  let body = "";
  // Two 40-bit halves (exact in a double), 8 symbols each.
  for (const offset of [0, 5]) {
    let chunk = 0;
    for (let i = 0; i < 5; i += 1) chunk = chunk * 256 + bytes[offset + i];
    for (let i = 7; i >= 0; i -= 1) body += KEY_ALPHABET[Math.floor(chunk / 2 ** (i * 5)) % 32];
  }
  return format(body);
}

/** Canonical `HPDG-XXXX-XXXX-XXXX-XXXX`, or null when the input cannot be a key. */
export function normalizeLicenseKey(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 64) return null;
  let compact = input.toUpperCase().replace(/[\s-]/g, "");
  if (compact.startsWith("HPDG")) compact = compact.slice(4);
  compact = compact.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (compact.length !== KEY_BODY_LENGTH) return null;
  for (const char of compact) if (!KEY_ALPHABET.includes(char)) return null;
  return format(compact);
}

/** Lookup hash stored in `hpdg_license_keys.key_hash`. */
export function licenseKeyHash(normalizedKey: string): string {
  return createHash("sha256").update(`hpdg-license:${normalizedKey}`).digest("hex");
}

export function keysEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
