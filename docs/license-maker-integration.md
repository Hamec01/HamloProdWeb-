# Beat licenses

The site renders the original `LICENSEMAKER/templates/default_template.json`
(version 2.2) with escaped buyer/seller values. Both languages and schedules A–C
are retained. The bundled seller identity and signature match the desktop app;
`/admin/licenses` lets an administrator save an override and upload a replacement
PNG/JPEG signature. Seller settings are private database records.

- The buyer form collects the full name, country, city, email, phone and optional
  artist name. The contract shown before payment is saved as an HTML snapshot.
- For Telegram/VK sales the buyer submits the same form and sees contact links
  with the order number. The request appears in `/admin/licenses`; an admin
  confirms received payment and issues the exact accepted snapshot as a PDF.
- A verified Stripe/Lava paid notification generates a PDF in private S3 storage.
  A failed render/upload returns a retryable error after preserving the paid sale.
  Repeated notifications/downloads reuse the issued PDF and snapshot.
- `/profile` offers an authenticated PDF download. Only the order's buyer can
  download it; an administrator can also download/retry any paid order through
  `/admin/licenses`.
- Manual sales record the buyer details and confirmed payment/consents, atomically
  mark the beat sold and generate the same PDF. A matching registered email links
  that sale to the buyer's profile. The admin can retry PDF generation after a
  temporary failure without recording another sale.
- Price changes require returning to checkout and reviewing the new contract.
  PDF downloads cannot edit a paid order's identity or accepted terms.
- Composition shares, rights review results and existing release identifiers are
  not inferred from a payment. Unprovided schedule values remain unfilled.

Apply Prisma migrations before deployment. This release adds checkout acceptance
fields (the previously prepared `20261029230000` migration) and
`20261117120000_license_seller_settings`. Chromium is bundled for serverless PDF
rendering. A local installation can override it with
`PDF_CHROMIUM_EXECUTABLE_PATH`.

The production Stripe endpoint also handles HPDG keys/refunds. Beat checkouts are
routed by `metadata.orderId`; the existing HPDG handler is preserved.
`STRIPE_SECRET_KEY` and `PAID_CHECKOUT_ENABLED=true` are required to offer online beat checkout. Until configured,
beat buyers submit their license details and contact Telegram/VK; the administrator
confirms received payment. Direct manual sales remain available for off-site buyers. `STRIPE_WEBHOOK_SECRET` must correspond to the existing Stripe destination;
subscribe to `checkout.session.completed` and asynchronous success/failure events
if delayed payment methods are enabled. Never put these values in client code.

Verification: TypeScript and production builds; 199 tests passed in the isolated
`hamloprod_license_test` database. The gated integration test checks actual PDF
rendering/private upload/download, a signed synthetic Stripe notification,
storage failure/retry, immutable snapshots and prevention of a second exclusive
sale. It never charges a payment method or sends mail. Run it only with
`LICENSE_INTEGRATION_TEST=1` and that isolated database URL.

Browser/HTTP verification also covers seller-setting saves, manual sale from the admin UI,
buyer-created contact requests, administrator payment confirmation and protected PDF download.
