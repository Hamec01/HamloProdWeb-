# Beat playback, catalogue load and Telegram publication

Based on the live HPDG 808 release (`6cd5356`), keeping unrelated checkout edits out of production.

- The catalogue reads at most 30 rows per page, with a total count and stable createdAt/id ordering.
- Genre links filter the entire catalogue and reset the page. Pagination retains the genre.
- The carousel selects 12 distinct public beats with PostgreSQL random ordering on each page request. The visual loop duplicates this small set only.
- Like totals and the current user's reaction are queried together on the server instead of starting a request for every card.
- Visible covers use lazy, cached Next Image thumbnails. A public cover origin route reads only published available/reserved covers through authenticated storage and avoids the image optimizer's fixed seven-second external fetch timeout. Signed storage URLs are never sent to clients.
- Public preview audio is streamed through a same-origin route, with byte-range forwarding and no buffering of the full file. Private masters/archives are never selected. Versioned URLs prevent stale images/audio after replacement.
- The player shows loading and errors, uses actual audio metadata for duration, retries failed sources, and ignores stale aborted play promises during switching.
- Telegram preparation retrieves both source files before sending anything. Covers become a bounded JPEG; cover and MP3 are uploaded as multipart bytes. Provider sends are never retried automatically. Partial/ambiguous sends tell the owner to check the channel first.

Verification does not send Telegram messages. Transport tests use a mocked Telegram API; latest real source files are downloaded and prepared with the same code. Publishing from the existing owner button remains the user's action.
