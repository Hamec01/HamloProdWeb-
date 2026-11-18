# Beat catalogue search — 2026-11-18

The genre toolbar now contains a search field. Typing refreshes results after a
350ms pause; Enter/search button submits immediately. Search matches title,
CASE number and slug case-insensitively, including partial words. Multiple words
are combined. Queries are trimmed, whitespace-normalized and capped at 120
characters; SQL wildcard characters are treated literally.

Filtering happens in the public catalogue database query before counting and
pagination, so it covers every page. Genre and page links retain the query;
editing/clearing the query returns to page one and retains the genre. Search is
also represented in `q` for sharing/reloading. Private and unpublished beats
remain excluded. No payment or schema changes were needed.

Verification: four pagination/search navigation tests passed; production build,
TypeScript and changed-file ESLint passed. The isolated browser check covered
partial Cyrillic names, CASE numbers, multiple words, beats older than page one,
genre switching, pagination/reset/clear, literal percent/underscore and injection
text, private/unpublished exclusion, retained typing focus and 390px/320px
layouts. No browser JavaScript errors. SQL fixtures used only
`hamloprod_license_test`.

## Publication

Application commit `fddc2d9` was published as production deployment
`dpl_DouR2SqPSNMR9qCrcxxjC9ScxpN6`
(`https://hamlo-prod-l3tb21dst-inkeritm-4372s-projects.vercel.app`). Both production
alias mappings completed. Staged search/genre pages passed in Russian and the
English search field rendered correctly after READY. The deployment error/fatal
log query returned no rows.

The final anonymous browser check on `hamloprod.org` passed: after hydration,
typing a real public CASE updated the URL and rendered its matching card,
retained input focus and cleared back to the full catalogue. No JavaScript
errors or purchase/payment mutations. Plain scripted fetches encountered Vercel's
Security Checkpoint; browser verification succeeded without changing protection.

The local QA server was stopped and its isolated fixture database was dropped.
No primary beats, customers, orders or loyalty balances were edited for testing.
