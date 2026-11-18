# Beat Stripe checkout, private Google Drive delivery and account menu

Release worktree: `/home/deploy/projects/hamloprod-web-worktrees/license-maker`,
branch `feat/license-maker-integration`. The existing Stripe account and signed
`/api/stripe/webhook` endpoint are reused; HPDG Payment Link fulfillment remains
on its existing handler. Stripe checkout requires `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and `PAID_CHECKOUT_ENABLED=true`. The new key was supplied
by the owner directly as a Production Secret in Vercel; its value was not read
through management tools or printed.

The administrator attaches a private Google Drive file/folder link through
Beats → Edit → File after purchase. `BeatDelivery` is a separate private relation,
not a public Beat DTO field. The API requires an ADMIN session and trusted origin
for writes, validates real Drive host/path shapes, and never fetches the external
URL. Public catalogue/detail/API data and unpaid order conversations omit the
URL. A positive USD price and delivery link are required for automatic checkout.

Card payment is available in both interface languages, priced in USD. Contact
requests, on-site chat, week-long reservations and 100-point redemption remain
available. The accepted contract, price and delivery URL are fixed before
starting Stripe. A row lock claims the beat before calling Stripe; another
payment/manual sale cannot race that claim. Uncertain API failures retain the
claim and can retry the same immutable idempotent request. A checkout expires in
one hour. Expiry webhooks or a fresh verified Stripe API read release an unpaid
expired claim; the local clock alone does not release possibly paid inventory.

A signed paid event validates session/order/reference, amount and currency.
Fulfillment marks the beat SOLD, awards 25 points once, exposes the frozen Drive
URL and creates the private PDF from the accepted contract. The buyer returns
to their order and can also verify payment directly against Stripe. A success
redirect alone cannot unlock a file. Duplicate events reuse the existing award
and PDF. Producer-provided delivery is also attached to manual/free paid orders.
S3 operations now have bounded connection/request timeouts and retries so PDF
failures can be retried without indefinite waiting. Existing paid sales remain
saved when PDF creation temporarily fails.

The header now has an account dropdown with identity, live point balance, owned
purchase/request counts and unread conversation count. It links to profile,
purchased beats, requests/payments, messages, points and sign out. Public and
locale/sector headers use it, with keyboard/Escape/outside-click behavior and a
bounded mobile panel. Account summary always derives identity from the current
session, never a requested user ID. Profile sections filter and paginate actual
owned orders; messages include both the general chat and paged beat threads.

Migration: `20261118120000_beat_drive_delivery` creates only `beat_deliveries`.

Completed verification before release:
- Production build/TypeScript and changed-file ESLint passed.
- Full isolated suite: 263 passed, zero failures, one optional skip.
- Includes real private PDF generation/download and cleanup, signed payment
  retries, inventory competition on independent DB connections, uncertain
  creation recovery, verified expiry, frozen delivery and exact reward checks.
- Browser: administrator saves hidden Drive link; Russian buyer reviews a USD
  contract, reaches checkout; unpaid redirect and outsider access cannot unlock
  downloads; signed payment unlocks a real generated/downloaded PDF and Drive
  link, exactly +25 and SOLD; duplicate event does not award again; archive
  survives logout/login. Payment-provider API/UI used local isolated fixtures;
  application, PostgreSQL and private PDF storage paths were real.
- Account menu browser checks: fresh balance/counts/unread, separate purchases,
  points and message views, foreign/anonymous summary rejection, Escape focus,
  390px layout without horizontal overflow and sign out. No browser errors.

The opt-in deployment check (`STRIPE_CONNECTION_CHECK=true`) creates one
unadvertised unpaid Checkout Session using the real deployment credential,
retrieves it and immediately expires it. No purchase is marked paid and no money
is charged. It prints only a success/failure code, never a key or checkout URL.

The real-key deployment probe passed on staged deployment
`dpl_4bGF7WU5ukgrBpCtYhrePBS61KTb`: checkout creation, retrieval and expiry all
succeeded and no payment was taken. The probe did not create an application
order or send a customer license/email. Subsequent source changes only preserve
the explicitly chosen manual/Stripe method on license edit links and let old
unqualified checkout links fall back to manual requests when no delivery is set.
Stripe remains explicitly selectable in Russian and English independently of
those defaults. The full regression suite was rerun after these changes: 263
passed, zero failed, one optional skip. The additive migration was applied to
the primary database and all four runtime CRUD privileges were confirmed.
