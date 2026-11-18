# Registered users, private messages, notes and point grants

The production application is maintained in the release worktree
`/home/deploy/projects/hamloprod-web-worktrees/license-maker`, branch
`feat/license-maker-integration`.

Administrators open `/admin/users` from the sidebar. The directory lists every
registered account with search, stable pagination, registration/sign-in dates,
completed purchase count, balance and unread customer-message status. Each
account has a detail page linking its paginated orders, a general conversation,
private producer notes and manual point grants.

General conversations are independent of beat orders. Customers access their own
conversation through `/profile/messages` and a link/unread indicator in their
profile. Messages are plain text, paginated and refreshed automatically. Only
the customer owning the thread and an authenticated administrator can access it.
Client nonces prevent duplicate sends; read markers advance monotonically and
server rendering/prefetch does not mark a message as read.

Notes are stored separately and returned only through administrator endpoints.
Customers never receive notes in conversation/profile payloads. Notes and point
credits retain their author and date. Notes are append-only with paged history.

Manual credits accept 1–10000 whole points with a required reason that the
customer can see. A credit is recorded transactionally with an atomic balance
increment. Its request UUID makes retries idempotent, including a lost response
followed by activity in another form. Separate request identities are retained
for notes and credits. Concurrent credit/spend writes preserve both changes;
integer overflow rolls back the credit. The same balance remains spendable under
the existing 100-point/free-beat policy. Manual credits do not fabricate purchase
records or additional rewards.

Migration `20261118100000_user_management` adds conversations, general messages,
private notes and the manual credit ledger. It is additive and leaves existing
orders, licenses, reservations and balances intact. SQL constraints validate
message roles, nonblank text, credit amounts and reasons. API mutations require
a trusted origin; admin-only operations require an ADMIN session on the admin
surface. Public role strings cannot grant administrative access.

Verification: production build, TypeScript and scoped ESLint passed. The focused
suite passed 257 tests with zero failures and one optional skip, including the
new independent-connection tests for message privacy/pagination, read state,
private notes, duplicate/conflicting credits, concurrent credits/spending and
invalid input/overflow. Two pre-existing PDF integration tests are outside that
focused run. A full-suite attempt reached a 120-second timeout in the existing
license issuance integration; the full suite is not recorded as passing for
this release. Earlier overloaded QA runs hit the four-connection migrator-role
limit; final focused tests run without the local browser/server competing for
those connections. QA uses only the isolated `hamloprod_license_test` database.

## Published release

Application commit `64a88a0` was built as production deployment
`dpl_GA2EhvScC5zfWgPymvAP29Lj23Bo` at
`https://hamlo-prod-e6iqf197z-inkeritm-4372s-projects.vercel.app`.
The additive migration was applied to the primary database and runtime-role
permissions on the new tables were verified before promotion. Both production
domain mappings completed; https://hamloprod.org/admin/users is live.
Post-promotion checks passed for directory/profile login redirects, anonymous
rejection on notes/points/messages, the loyalty endpoint and public beat list.
The deployment error/fatal log query returned no records in its recent window.

Browser/API QA passed the complete directory/search/pagination story, producer
and customer messages with unread state, escaping and privacy of notes, 25+75
manual credits, a failed history read after a successful credit followed by a
note save and safe credit retry, role/owner/origin/input rejection, logout/login
persistence, and a 390px mobile layout without page overflow or browser errors.
The local Chromium test run disabled GPU acceleration and decorative effects.
A further full-suite attempt made progress through PDF generation/payment
idempotency but stalled around S3 test cleanup; it was stopped and is not
reported as a successful full-suite run. The focused 257-pass result remains the
completed regression result for this release.

The local QA server/test processes were stopped and the isolated database was
removed. No PDF keys remained on the recorded QA orders at cleanup. Listing
private object prefixes timed out, so the remaining isolated order IDs were
retained in `/tmp/hamlo-users-qa-cleanup-manifest.json` for any later orphan-file
inspection. No real production customers were messaged or granted test points.
