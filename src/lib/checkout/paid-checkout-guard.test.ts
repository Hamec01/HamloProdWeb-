import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Static wiring checks for the `PAID_CHECKOUT_ENABLED` kill switch.
 *
 * `npm test` only globs `src/lib/**`, so the route/page handlers cannot be
 * exercised over HTTP here. Instead we assert — file by file — that the guard
 * runs BEFORE any Order write, Lava call, contract generation or request-body
 * parse, and that every paid-checkout entry point in the UI is gated. The
 * runtime behaviour of the guard itself (fail-closed default, controlled 503)
 * is covered by ./config.test.ts.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const CONFIG_IMPORT = 'from "@/lib/checkout/config"';
const GUARD_CALL = "isPaidCheckoutEnabled()";

/** API routes: the guard must precede every side effect. */
const API_ROUTES: { file: string; sideEffects: string[] }[] = [
  {
    // POST /api/checkout — must never create or change an Order.
    file: "src/app/api/checkout/route.ts",
    sideEffects: ["prisma.", "checkoutFormSchema.safeParse"],
  },
  {
    // POST /api/payments/create — must never contact Lava.
    file: "src/app/api/payments/create/route.ts",
    sideEffects: ["preparePaymentCreation(", "paymentCreateRequestSchema.safeParse"],
  },
  {
    // POST /api/contracts/preview — no new checkout contract snapshot.
    file: "src/app/api/contracts/preview/route.ts",
    sideEffects: ["generateAndSaveContractSnapshot(", "contractPreviewRequestSchema.safeParse"],
  },
  {
    // POST /api/contracts/pdf — no new rights PDF, no order mutation.
    file: "src/app/api/contracts/pdf/route.ts",
    sideEffects: ["createRightsContractPdf(", "contractPdfCreateSchema.safeParse"],
  },
];

for (const { file, sideEffects } of API_ROUTES) {
  test(`${file}: guard runs before any side effect and returns a controlled 503`, () => {
    const src = read(file);

    assert.ok(src.includes(CONFIG_IMPORT), `${file} does not import from @/lib/checkout/config`);
    assert.ok(src.includes("paidCheckoutDisabledResponse"), `${file} does not use paidCheckoutDisabledResponse`);

    // Only look at the request handler body — helpers/imports above it may name the same symbols.
    const body = src.slice(src.indexOf("export async function POST"));
    const guardIdx = body.indexOf(`if (!${GUARD_CALL})`);
    assert.ok(guardIdx > 0, `${file} has no "if (!isPaidCheckoutEnabled())" guard`);

    // The guard's own block returns the controlled 503 payload.
    const guardBlock = body.slice(guardIdx, guardIdx + 220);
    assert.ok(
      guardBlock.includes("paidCheckoutDisabledResponse()") && guardBlock.includes("d.status"),
      `${file} guard block does not return paidCheckoutDisabledResponse()`,
    );

    // requireBuyer stays first (auth before feature flag); the guard is next.
    const requireBuyerIdx = body.indexOf("requireBuyer(request)");
    assert.ok(requireBuyerIdx > 0 && requireBuyerIdx < guardIdx, `${file}: guard must come after requireBuyer`);

    for (const token of sideEffects) {
      const idx = body.indexOf(token);
      assert.ok(idx > guardIdx, `${file}: "${token}" appears before the paid-checkout guard (idx ${idx} vs guard ${guardIdx})`);
    }
  });
}

test("src/app/api/lava/webhook/route.ts: acknowledges quietly when disabled, after signature check", () => {
  const file = "src/app/api/lava/webhook/route.ts";
  const src = read(file);

  assert.ok(src.includes(CONFIG_IMPORT), `${file} does not import from @/lib/checkout/config`);

  // Only look at the request handler body — helpers/imports above it also name prisma.
  const body = src.slice(src.indexOf("export async function POST"));
  const verifyIdx = body.indexOf("verifyLavaWebhookSignature(");
  const guardIdx = body.indexOf(`if (!${GUARD_CALL})`);
  assert.ok(guardIdx > 0, `${file} has no paid-checkout guard`);
  assert.ok(verifyIdx > 0 && verifyIdx < guardIdx, `${file}: signature must be verified before the flag check`);

  // Disabled → 200 ack, never a DB write or body parse.
  const guardBlock = body.slice(guardIdx, guardIdx + 200);
  assert.ok(guardBlock.includes("paid_checkout_disabled"), `${file}: disabled branch must state the reason`);
  assert.doesNotMatch(guardBlock, /status:\s*[45]\d\d/, `${file}: disabled branch must not return a 4xx/5xx`);

  for (const token of ["prisma.", "JSON.parse(rawBody)"]) {
    const idx = body.indexOf(token);
    assert.ok(idx > guardIdx, `${file}: "${token}" runs before the paid-checkout guard`);
  }
});

/** Buyer-facing pages that used to lead into paid checkout. */
const GATED_PAGES = [
  "src/app/(public)/beats/[slug]/page.tsx",
  "src/app/(public)/checkout/[slug]/page.tsx",
  "src/app/(public)/checkout/preview/[orderId]/page.tsx",
  "src/app/(public)/checkout/payment/[orderId]/page.tsx",
  "src/app/(public)/checkout/rights/[orderId]/page.tsx",
];

for (const file of GATED_PAGES) {
  test(`${file}: gated on isPaidCheckoutEnabled with the disabled notice`, () => {
    const src = read(file);
    assert.ok(src.includes(CONFIG_IMPORT), `${file} does not import the flag`);
    assert.ok(src.includes(GUARD_CALL), `${file} does not call isPaidCheckoutEnabled()`);
    assert.ok(src.includes("<PaymentsDisabledNotice"), `${file} does not render <PaymentsDisabledNotice />`);
  });
}

test("beats page: the paid Buy-License CTA is only in the enabled branch", () => {
  const src = read("src/app/(public)/beats/[slug]/page.tsx");
  const branchIdx = src.indexOf("paidCheckoutEnabled ? (");
  const ctaIdx = src.indexOf("{t.buyLicense}");
  const noticeIdx = src.indexOf("<PaymentsDisabledNotice");
  assert.ok(branchIdx > 0 && ctaIdx > branchIdx, "buy-license CTA is not inside the enabled branch");
  assert.ok(noticeIdx > ctaIdx, "disabled notice is not the else branch");
});

test("checkout form page: the disabled notice returns before <CheckoutForm> is rendered", () => {
  const src = read("src/app/(public)/checkout/[slug]/page.tsx");
  const guardIdx = src.indexOf(`if (!${GUARD_CALL})`);
  const formIdx = src.indexOf("<CheckoutForm");
  assert.ok(guardIdx > 0 && formIdx > guardIdx, "CheckoutForm can render while paid checkout is disabled");
});

test("profile page: the rights-form link is hidden while paid checkout is disabled", () => {
  const src = read("src/app/(public)/profile/page.tsx");
  assert.ok(src.includes(CONFIG_IMPORT), "profile page does not import the flag");
  const gateIdx = src.indexOf("paidCheckoutEnabled &&");
  const linkIdx = src.indexOf("/checkout/rights/");
  assert.ok(gateIdx > 0 && linkIdx > gateIdx, "profile rights-form link is not gated on paidCheckoutEnabled");
});

test("no un-gated checkout entry point exists anywhere under src/", () => {
  // Every source reference to a /checkout/ path must live in a file that also
  // consults the flag (the gated pages) or is a pure server helper/route.
  const allowlist = new Set([
    ...GATED_PAGES,
    "src/app/(public)/profile/page.tsx",
    "src/components/checkout/checkout-form.tsx", // client form, only mounted by the gated [slug] page
    "src/lib/contracts/preview.ts", // builds previewUrl; only reached through the gated preview route/page
  ]);

  let hits = "";
  try {
    hits = execFileSync(
      "git",
      ["grep", "-l", "-E", "[\"'`(]/checkout/", "--", "src/**/*.ts", "src/**/*.tsx"],
      { cwd: root, encoding: "utf8" },
    );
  } catch {
    hits = "";
  }

  const offenders = hits
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes(".test."))
    .filter((file) => !file.startsWith("src/app/api/")) // API routes are guarded separately above
    .filter((file) => !allowlist.has(file));

  assert.deepEqual(offenders, [], `un-gated /checkout/ reference(s) in: ${offenders.join(", ")}`);
});
