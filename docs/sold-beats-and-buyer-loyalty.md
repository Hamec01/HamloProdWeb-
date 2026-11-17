# Sold beat cards and registered buyer sales — 2026-11-18

Release source: branch `feat/license-maker-integration`, application commit
`498cb10`, checkout `/home/deploy/projects/hamloprod-web-worktrees/license-maker`.

The license form has a dark, searchable radio list of available beats and an
admin-only registered-account search by email/display name. Selecting an account
fills and locks its email. Full legal name and the other license fields remain
editable. On confirmed manual sale, the order/PDF is linked to that account and
one loyalty point is awarded in the sale transaction. The same award helper serves
confirmed contact orders and beat payment webhooks. A per-order atomic claim
prevents duplicate points on retries; PDF rendering does not award points.
The existing discount thresholds are unchanged.

Published sold beats remain visible in the catalogue and detail pages with a large
SOLD label. Their public DTO omits audio and disables downloads. Purchase/contact
buttons are hidden, download/purchase endpoints reject sold beats, and admin edits
cannot reactivate them. The existing database sale guard also keeps downloads off.
Cover images remain visible. Seller configuration is collapsible so the sale form
is easier to reach.

Migration `20261118003000_sold_lock_and_sale_loyalty` adds the loyalty claim field,
normalizes download availability, and reconciles confirmed historical exclusive
sales to SOLD. One previously available/reserved beat required that correction.
No loyalty balances were backfilled for historical sales.

Validation: production build passed; 252 tests passed, one unrelated optional test
was skipped. Browser/API QA on an isolated database verified account search and
selection, manual sale, one-point credit, profile/PDF linkage, the SOLD catalogue
card, rejected downloads/checkout/repeat purchases/reactivation, and unchanged
points after PDF retries. Test objects and the temporary database were removed.

Published to https://hamloprod.org from deployment
`dpl_4sZh9ZUpVP22k9VT3t5nZi32Udxj` after testing the staged production build.
Previous production deployment retained: `dpl_BnvbKE26BSjVKz6XRRj1yymvnXgw`.
After promotion, the real sold beat detail returned 200 with SOLD and no purchase
link; unauthenticated account search returned 401. Both production aliases mapped
successfully. The production migration completed successfully before promotion.
