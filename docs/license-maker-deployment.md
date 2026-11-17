# LicenseMaker integration — 2026-11-17

Published: https://hamloprod.org/admin/licenses

Release source: `/home/deploy/projects/hamloprod-web-worktrees/license-maker`,
branch `feat/license-maker-integration`, application commit `887168c`.
Deployment: `dpl_BnvbKE26BSjVKz6XRRj1yymvnXgw` (staged with production settings,
verified, then promoted). Previous production deployment retained:
`dpl_AUMTuiZW4fLFd3r8Lc3EP5UoVbGs`.

Telegram/VK sales remain active. A buyer fills the site form; an administrator
confirms received payment and the PDF becomes available in the buyer's profile.
Direct manual sales and seller identity/signature settings are at `/admin/licenses`.
Stripe payment creation stays disabled until both `STRIPE_SECRET_KEY` and
`PAID_CHECKOUT_ENABLED=true` are configured. Existing HPDG checkout/refund handling,
admin pages, image optimization settings and localized beat pages are preserved.

Applied to the production database:

- `20261029230000_stripe_and_license_acceptance`
- `20261117120000_license_seller_settings`

Verification: production build passed; 250 tests passed and one unrelated optional
test was skipped in an isolated database. Browser QA covered saving seller data,
manual sale and buyer PDF access. HTTP QA covered a buyer-submitted contact request,
admin confirmation, the unchanged accepted snapshot and real private PDF download;
unpaid/unauthenticated requests were rejected. The eight-page RU/EN PDF was rendered
and visually checked. Chromium binaries/fonts and the seller signature are included
in the server function bundles. Staged catalogue/HPDG routes returned 200, and the
PDF route rejected unauthenticated requests with 401. Public production routes and
admin login protection were checked after promotion. No real orders were created
or edited for QA; temporary test data, database and private PDF objects were removed.

See `license-maker-integration.md` for implementation and runtime configuration.
