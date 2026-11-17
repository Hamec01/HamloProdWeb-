# On-site purchase requests, chat, reservations and points — 2026-11-18

Source: branch `feat/license-maker-integration` in
`/home/deploy/projects/hamloprod-web-worktrees/license-maker`.

The beat card/detail Buy / Message action creates or reopens an authenticated
contact request immediately. The producer sees even incomplete requests in
`/admin/licenses`. Buyer and administrator share `/orders/<id>` with private,
plain-text messages, read indicators and automatic refresh. Message nonces prevent
duplicates on retry; history is paginated. Buyers cannot access another account's
request. Conversation mutations require a same-origin request.

The buyer or producer can reserve the requested beat for exactly seven days.
Repeated reservation requests do not extend a running hold. Only that buyer can
complete its sale while the hold is active; the producer can remove the hold in
the request. Expired holds are released during catalogue/inbox/conversation reads
and checked again under a row lock at purchase time. No scheduler is needed for
availability enforcement. Completed sales clear the reservation and remain SOLD.

The buyer fills license details and accepts the agreement from the same request.
After receiving payment the producer confirms the request and issues the frozen
PDF. The purchase and PDF appear in the buyer's profile, with 25 points awarded
once for a paid purchase. 100 points can be exchanged for one available beat;
the server atomically deducts 100 and completes the order. Free beats earn zero
points. Concurrent claims cannot overspend the same balance, and PDF retries do
not award points. Existing balances and points history are scaled by 25 so the
previous one-point-per-purchase progress is retained. The old unverified loyalty
acquisition endpoint no longer grants points.

Migration: `20261118013000_order_chat_reservations_points`. Adds private messages,
read markers, reservation fields and an order-level points-spent record; scales
legacy point balances/history. Existing seller settings and license templates,
HPDG payment handling and public assets are retained. The redemption PDF function
includes Chromium and signature assets.

Validation: production build and TypeScript passed; 254 tests passed and one
unrelated optional test was skipped. Integration tests use an isolated database
and independent connections to verify competing reservations, expiry, private
message access, pagination, idempotency and concurrent redemption. Browser/API QA
covered the full Russian contact-request flow, both sides of the chat, a weekly
hold, legal details, producer payment confirmation, PDF access, +25 points and a
100-point exchange with zero additional reward. Foreign-account reads/writes and
role spoofing were rejected. No real buyers were messaged for QA.

The customer profile is a persistent archive with pagination rather than a
50-order cutoff. Each completed purchase can show its PDF, producer-provided
MP3/download URL and the order conversation; points stay attached to the account.
The producer sets a persistent HTTPS MP3/share URL in the paid order conversation.
Only the administrator can edit delivery, and the link is returned only to that
purchase's buyer or an administrator after payment confirmation. No external
URL is fetched by the server. Migration `20261118020000_order_mp3_delivery` adds
the delivery field. Delivery URL validation rejects executable/invalid links.
