# HPDG Beta 7 release

Version: `0.1.0-beta.7`, Windows 10/11 x64, VST3, 919 factory samples.
Installer: 122160358 bytes, SHA-256
`40aac7abeb7b3d4f397b24ce0eda80f94e220c0cac95bc62b463edfeb1c35b87`.

## Publication

The source is based on the production VST catalog branch, not the older migration
checkout. Only the guide and customer release notes are in `public/hpdg/releases/beta7`.
The installer stays in private object storage. Internal handoff/verification files
and the ZIP must not be added to public files or deployment input.

`scripts/publish-hpdg-package.mts <private-package-directory>` validates release.json,
the local installer and a complete download from private storage before registering
a non-current release. Add `--activate` after the site is ready to switch download
and updater APIs. Existing versions and objects remain available for rollback via
the release controls in `/admin/hpdg`. The public latest API can cache for 300 seconds.

## Update email in the admin panel

1. Open `/admin/hpdg` → **Письмо об обновлении** → **Открыть текст и получателей**.
2. Review the subject, text and addresses, then **Подготовить рассылку**. This freezes
   one campaign per release. The Beta 7 English template includes the PDF link and
   manual download page, with the internal agent note removed.
3. Send a test to your own address, receive it and check the text and links, then
   confirm actual receipt. Check the Windows/DAW update before a buyer broadcast.
4. Click **Отправить покупателям**. Up to five outstanding recipients are processed
   per click. **Проверить доставку** retrieves provider delivery status separately.

Recipients are unique normalized emails with active Stripe/Stripe CSV purchase
keys. Manual/test and revoked keys are excluded. A donation plus a purchase under
the same email never creates two recipients. The existing HPDG webhook ignores
donation Payment Links. CSV imports remain an explicit admin selection: select
HPDG purchases, not unrelated payments or donations.

Every recipient has a persistent claim and provider message ID. Already accepted
or delivered messages are never resent. Only definite HTTP rejection is retryable;
timeouts, interrupted sends and ambiguous responses require manual reconciliation
in Resend. This database record extends duplicate protection beyond Resend's
24-hour idempotency window. Sending acceptance is not reported as delivery.

Uses the existing `RESEND_API_KEY`, `HPDG_MAIL_FROM` and `HPDG_MAIL_REPLY_TO` settings.
Reading delivery status requires permission to retrieve sent emails; if the key is
send-only, review delivery in the Resend dashboard. Preparation, publication and
deployment do not send messages automatically.

## Verification

- Production build, TypeScript and existing test suite.
- Dedicated disposable PostgreSQL database: recipient deduplication, test-receipt
  gate, concurrent sends, revocation after preparation, ambiguous failures and rollback.
- Browser: RU/EN pages, mobile page layout, PDF link, admin preparation, two unique
  test buyers and broadcast disabled before test receipt. Anonymous and foreign-origin
  API requests rejected.
- Installer storage round trip: full byte count and SHA-256 verified.

The Linux website environment cannot launch the Windows installer or audition the
plugin inside a DAW. Those checks and actual test-email receipt remain owner checks;
mocked mail tests are not evidence of delivery to real inboxes.

## Video section and visible release summary

The existing Video section includes six verified public videos from
https://www.youtube.com/@hpdgvst (channel `UCruQVITDiU1b1zWi5PAaZiA`).
Selected IDs: `SK3EnGJ92HQ`, `qF5HT82e0T0`, `EncE73aViI4`, `TvjsnCh6J8w`,
`dfGLEPtaYG8`, `d17_KGVUdBw`. Their public oEmbed responses were checked and
thumbnail assets are served locally from `/hpdg/youtube/`.

All six videos are embedded directly as YouTube players, in two columns on desktop
and one on mobile. Each player uses youtube-nocookie.com with `autoplay=0`, visible
controls and no autoplay permission. Iframes load lazily as the visitor scrolls;
pressing the native YouTube Play button starts the selected video. The original
direct MP4 remains inside a collapsed disclosure, with controls and no autoplay.
The older overview is explicitly labelled Beta 6.

Both VST catalog cards now show Beta 7 and 919 samples. The HPDG hero identifies
Beta 7 beside the product name, and a release summary appears before Video.
