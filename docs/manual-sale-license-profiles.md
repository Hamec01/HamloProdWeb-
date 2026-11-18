# Manual checkout, license profiles and visible beat delivery — 2026-11-18

The private Google Drive field now appears inside Edit Beat, below the prices,
with its own «Сохранить ссылку Google Диска» button. Previously it was rendered
above the editor and was easy to miss. It uses no nested form and retains the
existing administrator-only delivery API and paid-order disclosure rules.

«Купить бит через сайт» in the purchase chooser opens contact checkout directly,
so the buyer supplies their legal name, artist name, contact email, country and
city and accepts the agreement before the administrator confirms payment. The
separate message and reservation actions remain available. An explicit contact
selection survives the login redirect in either locale.

The private profile section «Данные для лицензии» stores reusable details for
the signed-in account. Checkout prefills them and offers an explicit checkbox
to save edited details for future purchases. Phone is optional; no passport
fields are collected. Acceptance and data consent remain per-order and are never
prefilled from the saved profile. Later profile edits leave accepted snapshots
and issued PDFs unchanged.

The receipt checkbox is available to the administrator even for an old request
without buyer details. PDF issuance still requires the buyer's completed and
accepted contract. Those requests now provide a copyable link to the buyer form.
Payment links in order messages are clickable and message HTML remains escaped.

## Verification

- 25 targeted unit/integration tests passed, zero failed/skipped. Covered profile
  validation, rejecting account-target/passport/consent injection, optional
  phone, explicit checkout consent, escaped chat links, existing contact and
  Stripe fulfillment, request archive and points behavior.
- Production build, TypeScript and changed-file ESLint passed.
- Isolated browser test used real admin/buyer sessions and verified inline link
  save/reload, no nested form or unpaid URL disclosure, editable receipt checkbox
  with server rejection before contract completion, profile save/prefill,
  anonymous/foreign-origin/account-target denial, manual checkout reuse of the
  original inquiry, clickable payment message, manual confirmation, real PDF
  generation/download, SOLD, private delivery and exactly 25 points, retained
  purchase in the cabinet and unchanged accepted snapshot after profile edits.
- Mobile profile layout had no page overflow. No browser JavaScript errors.
- No actual Stripe payment was taken. SQL/browser fixtures are isolated from
  production accounts and orders in `hamloprod_license_test`.

The additive `20261118170000_buyer_license_profiles` migration creates a private
profile table keyed by user UUID. Existing orders and profile data are retained.

## Production release

Application commit `848c036` was staged and published as
`dpl_5H42RuUkMZwJvf2AXFoY4SWcqCnF`
(`https://hamlo-prod-pffq68ywi-inkeritm-4372s-projects.vercel.app`). The primary
migration succeeded and all four runtime CRUD privileges on the profile table
were individually verified. Both production alias mappings completed.

After READY, staged checks passed for the new manual-purchase button, protected
profile page and mutation endpoint, HPDG808 1.0.1 and unsigned webhook rejection.
Canonical production checks confirmed the new chooser and private-profile
protections. The deployment error/fatal runtime-log query returned no rows.

The local QA server was stopped, its one real test PDF was deleted successfully,
and `hamloprod_license_test` was dropped. Primary accounts, orders and points
were not fabricated for this verification.
