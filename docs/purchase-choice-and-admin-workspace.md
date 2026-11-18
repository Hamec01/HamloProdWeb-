# Purchase choice and full-width admin workspace — 2026-11-18

Clicking Buy beat on either a catalogue card or beat detail now opens a native
modal with Stripe, purchase through site messages, and a seven-day reservation.
Stripe is visible in both languages, including when unavailable, with a disabled
button and a specific explanation. Missing delivery URLs still block payment on
the server. Existing orders, stock claims, PDFs and loyalty rules are unchanged.

The request page has an explicit payment section and links to its beat, the beat
catalogue and the account. Public headers and the account menu also link to the
catalogue. No private delivery URL is exposed to unpaid visitors by this change.

The administrator workspace uses the full viewport width with modest padding.
Navigation opens in a modal drawer, so it never reduces the content width. It
closes by its button, Escape, or selecting a destination. Native dialogs provide
focus trapping and focus restoration. New-beat defaults are USD 20 / RUB 2000,
matching the owner's requested catalogue prices.

Manual requests have an administrator-only «Убрать из списка» action and a
separate archive with restoration. This retains the buyer's request, messages,
amount and reservation. Fresh buyer messages or reopening the purchase action
return the same request to the active list. Retrying a previously sent message
does not reopen it. Paid sales and pending Stripe payments cannot be hidden by
this action. Completed sales explicitly show «Stripe · SOLD» when paid by card.

## Verification

- Targeted unit/integration tests: 21 passed, zero failed, zero skipped, against
  the isolated `hamloprod_license_test` database for SQL tests.
- Full production build and TypeScript checks passed.
- ESLint passed for changed components and modules. The existing CSV download
  anchor now explicitly declares `download`.
- Browser: card/detail purchase chooser; visible disabled Stripe for a missing
  file; API rejects that payment with 409; valid-file Stripe opens the license
  checkout in Russian and English; manual choice creates the correct request;
  reservation belongs to the buyer and lasts seven days; back links work;
  Escape restores focus; 390px/320px layouts have no horizontal page overflow.
- Browser: administrator workspace at 1560/1280/390/320px; full content width
  stays unchanged when opening navigation; close button, Escape and navigation
  close the drawer; no page overflow or JavaScript errors.
- Browser: archive and restore the correct request, retained buyer access and
  stock/reservation, automatic restoration on a fresh buyer message with unread
  indication, paid Stripe badge, denied buyer/editor/cross-origin/malformed
  archive calls and denied paid-order archival.

Production inspection found no attached beat delivery URLs, including the beat
`klub-ilicha`. The producer must add each beat's own Google Drive link through
Admin → Beats CRUD → Edit → «Файл бита после покупки» to enable automatic Stripe
delivery. No production link or purchase was fabricated and no charge was made.
The additive `20261118160000_admin_request_archive` migration adds a nullable
archive timestamp and listing index on orders; it was tested on the isolated
database before production. This release changes no Stripe credentials.

## Publication

Application commit `d4ff8a0` was published as production deployment
`dpl_BcUPjCSvV1SQecDdu12VDBQwxv1g`
(`https://hamlo-prod-pc763ycnr-inkeritm-4372s-projects.vercel.app`). Both
`hamloprod.org` and the project production alias completed promotion. The primary
migration applied successfully and runtime SELECT/UPDATE privileges on the new
column were verified; existing requests remained active.

After READY, staged checks passed for the actual catalogue, beat purchase
chooser, HPDG808 version 1.0.1, unsigned webhook rejection, unauthenticated
account-summary denial and archive API denial. The preview hostname's Origin
correctly received 403; with the canonical site Origin the unauthenticated
archive call correctly received 401. Canonical production page/API checks also
passed after promotion. The deployment error/fatal log query returned no rows.

All local QA processes were stopped. Remaining QA PDF references were checked
(zero objects left) and `hamloprod_license_test` was dropped. No production
customer, message, purchase, point award or real charge was created for QA.
