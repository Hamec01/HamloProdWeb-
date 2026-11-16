# HPDG 808 1.0.0

Product pages: `/en/vst/hpdg808` and `/ru/vst/hpdg808`, linked from the VST catalog and HPDG page.
Free download, no login or key, no video. A download dialog offers an optional email field and
an explicit **Download without email** action. Release date is omitted because none was supplied.
The existing HPDG price, release and update flow are independent.

## Installer

The package's 13 SHA-256 entries were verified before extracting the screenshots and guide.
Installer: `HPDG808_Setup_1.0.0.exe`, 23,289,262 bytes.
SHA-256: `a0bc029b3b3a90464e317986742d867173f19c8501f0c0506e700d88e8fd9c58`.

`GET /api/hpdg808/download` is intentionally public. It redirects to a five-minute signed attachment
URL with `Cache-Control: private, no-store`. Installer size and SHA-256 are checked at publication,
so download requests do not wait on additional storage metadata calls.
Payment and account state never affect access. The installer is not bundled into public assets.

`POST /api/hpdg808/download` serves the dialog: optional email + locale, validated server-side.
Supplied emails are normalised and upserted in `hpdg808_contacts`; leaving the field empty avoids
database access. No account is created and no email is sent. If saving an email fails, the download
still proceeds and the dialog reports the save failure. A successful save records interest in this
product, not a verified newsletter subscription. Export via the **HPDG 808 — Email CSV** link in the
admin sidebar; `/api/admin/hpdg808/contacts` requires an ADMIN session and is never publicly cached.

Migration: `20261116020000_hpdg808_contacts`. The connected database has HPDG migrations from
another checkout, so only this new independent table migration was applied and recorded; unrelated
pending migrations were preserved. For a clean deployment, apply this migration before accepting emails.

To prepare a clean environment, extract the installer from the supplied ZIP, then run:

```bash
python3 - <<'PY'
import zipfile
from pathlib import Path
with zipfile.ZipFile('docs/HPDG808_1.0.0_site_package.zip') as package:
    Path('/tmp/HPDG808_Setup_1.0.0.exe').write_bytes(package.read('HPDG808_1.0.0/HPDG808_Setup_1.0.0.exe'))
PY
npx tsx --env-file=.env scripts/publish-hpdg808.mts /tmp/HPDG808_Setup_1.0.0.exe
```

Uses the existing `S3_*` server configuration. Creates only the release's own object
`hpdg808/HPDG808_Setup_1.0.0.exe` in the private bucket. Never overwrites an existing object.
Always downloads it back and verifies both the size and SHA-256.

## Stripe tips

The owner's supplied link is connected by default on both language versions:
<https://buy.stripe.com/5kQfZj0kgaKFavQ4E6cjS02>.
`HPDG808_TIP_URL` can override it; an explicitly empty value hides the payment button.

Create a separate live Payment Link in the desktop Stripe Dashboard:
<https://dashboard.stripe.com/payment-links/create/customer-chooses-pricing>.

1. Select **Customers choose what to pay**.
2. Title: **HamloProd — a cup of tea for HPDG 808**.
3. Description: **HPDG 808 is free. This is an optional tip to support its development. Thank you!**
4. Choose your currency. Optionally suggest an amount, for example €3; the visitor can change it.
5. Click **Create link**. Set the optional post-payment redirect to
   `https://hamloprod.org/en/vst/hpdg808#support`.
6. Set `HPDG808_TIP_URL` to the returned `https://buy.stripe.com/...` or
   `https://donate.stripe.com/...` URL in the server environment and rebuild/redeploy.

Only this separate tip link is used. No webhook or secret key is needed for the tip button.
If the URL is explicitly disabled or invalid, the tea section remains visible but no payment button is rendered.
The free installer is available independently.

Official instructions: <https://docs.stripe.com/payment-links/create#customers-choose-what-to-pay>.

## Verification

- Production build and the three optional-email validation tests passed.
- English and Russian pages checked in Chromium at desktop and 390px mobile widths.
- Download dialogs, Escape dismissal, email submission and skipping an invalid optional field checked in the browser.
- API/database check confirmed normalised contact capture and deduplication; temporary test contacts were removed.
- Anonymous CSV requests return 403. Download responses are never cached.
- The actual stored installer was downloaded and verified against the package's size and SHA-256.
