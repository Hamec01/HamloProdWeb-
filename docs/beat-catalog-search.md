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
