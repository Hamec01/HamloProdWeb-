# Prepared delivery before payment confirmation — 2026-11-18

A saved Google Drive link OR a private uploaded ZIP is sufficient. ZIP is never
required when a link exists. If neither exists, the receipt checkbox and sale
submission stay disabled. Server-side checks also reject confirmation, direct
manual sale and point redemption without selling the beat or changing points.
Stripe checkout accepts either prepared delivery method before it claims stock.

The file-preparation block appears in the beat editor, the manual sale form and
the administrator's order conversation. It has the link field and an alternative
ZIP upload with progress/cancellation using the existing direct storage upload,
finalization and attachment flow. A typed but unsaved link does not enable sale.

Paid orders snapshot both attached delivery references. Customers receive a
protected ZIP download button in their order and purchases cabinet. The endpoint
checks the signed-in owner/administrator and paid status before issuing a short
private storage URL. No archive object key reaches the customer's conversation
DTO. Replacing a beat archive retains objects referenced by purchases or pending
checkout, including during the upload cleanup sweep.

## Verification

- 45 targeted unit/integration tests passed without failures/skips, including
  actual PDF integration, inventory, manual sale, points and upload lifecycle.
- The revised ZIP scenario was rerun separately: five tests passed, including
  direct manual-sale rejection without a file, link-only and ZIP-only fulfillment,
  guarded point spending, archive retention and signed Stripe fulfillment/retry.
- Production build, TypeScript and changed-file ESLint passed.
- Browser: missing both methods disables the checkbox and returns 409 on direct
  confirmation; anonymous/other-buyer/unpaid ZIP access is denied; real direct
  browser ZIP upload succeeds; manual confirmation produces a real PDF, SOLD,
  exactly 25 points and a byte-for-byte matching private ZIP download; unsigned
  storage access is denied. ZIP replacement preserves the customer's original
  file. Link-only confirmation succeeds with no archive attached. No JS errors.
- No real payment was charged. Data and actual PDF/ZIP uploads belong to isolated
  fixtures in `hamloprod_license_test`.

Migration `20261118180000_order_zip_delivery` adds a nullable private archive
snapshot column and an index on orders. Existing data is retained.

## Publication

Published application commit `eddc6f8` as production deployment
`dpl_BnDXDrzKDjKuKbKtX3rFtkX6DNKV`
(`https://hamlo-prod-7u0meb8iv-inkeritm-4372s-projects.vercel.app`). The primary
migration succeeded and runtime SELECT/UPDATE privileges on the archive snapshot
column were confirmed. Both production alias mappings completed.

After READY, staged checks passed for purchase choices, protected profile page
and mutation, HPDG808 1.0.1, unsigned webhook rejection and anonymous ZIP download
denial. Canonical production checks also passed. The error/fatal runtime-log
query returned no rows.

The QA server was stopped. Three actual QA PDF objects and three private ZIP
objects were deleted successfully, then `hamloprod_license_test` was dropped.
The unsigned object-access assertion accepts storage's 401 or 403 denial; the
complete browser scenario passed after correcting that expected status range.
No production account, message, sale or point award was created for QA.
