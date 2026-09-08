# TLS certificate for `db.hamloprod.org` (M1.3)

PgBouncer must present a certificate that a Vercel Function validates with
`sslmode=verify-full` against the **system trust store** (no custom CA bundling
required for the first cut). That means a real Let's Encrypt certificate for
`db.hamloprod.org`.

## Prerequisite — DNS (owner, Vercel dashboard)

`*.hamloprod.org` currently has a **wildcard → Vercel**, so `db.hamloprod.org`
resolves to Vercel today. Add an explicit record that overrides the wildcard:

| Type | Name | Value |
|---|---|---|
| `A` | `db` | `84.247.130.242` |
| `AAAA` | `db` | `2a02:c207:2340:7580::1` |

Vercel dashboard → **hamloprod.org → Settings → DNS → Add**. Verify:

```
dig +short A    db.hamloprod.org @ns1.vercel-dns.com     # → 84.247.130.242
dig +short AAAA db.hamloprod.org @ns1.vercel-dns.com     # → 2a02:c207:2340:7580::1
```

CAA already allows `letsencrypt.org` (checked: `dig CAA hamloprod.org`).

## Option A — DNS-01 via the Vercel API (recommended; no ports, no Caddy edit)

Vercel is the authoritative nameserver, and `lego` speaks its API. This works
even before the A record propagates, and renews unattended.

1. **Owner** creates a scoped Vercel API token (Account → Settings → Tokens;
   scope to the team that owns `hamloprod.org`; short expiry is fine, renewals
   just need it live at renewal time) and drops it on the VPS, never in chat:

   ```
   install -m 600 /dev/stdin /home/deploy/projects/hamloprod-web/deploy/preview-db/acme.env <<'EOF'
   VERCEL_API_TOKEN=<token>
   EOF
   ```

2. Issue (writes `certs/fullchain.pem` + `certs/privkey.pem` in lego's `--pem` layout):

   ```
   cd /home/deploy/projects/hamloprod-web
   docker run --rm \
     --env-file deploy/preview-db/acme.env \
     -v "$PWD/deploy/preview-db/certs:/certs" \
     goacme/lego:v4.19.2 \
       --accept-tos --email ops@hamloprod.org \
       --dns vercel --pem \
       --path /certs \
       -d db.hamloprod.org run

   # lego --pem writes /certs/certificates/db.hamloprod.org.pem (key+cert). Split
   # into the names PgBouncer expects:
   cd deploy/preview-db/certs/certificates
   awk 'BEGIN{c=0} /BEGIN/{c++} c>=2{print > "../fullchain.pem"} c==1{print > "../privkey.pem.tmp"}' db.hamloprod.org.pem
   # simpler and robust: lego also writes the parts separately —
   cp db.hamloprod.org.crt ../fullchain.pem
   cp db.hamloprod.org.key ../privkey.pem
   cd ../.. && chmod 0644 certs/fullchain.pem certs/privkey.pem
   ```

3. Renewal — weekly, unattended (cron for the `deploy` user):

   ```
   15 3 * * 1  cd /home/deploy/projects/hamloprod-web && \
     docker run --rm --env-file deploy/preview-db/acme.env \
       -v "$PWD/deploy/preview-db/certs:/certs" goacme/lego:v4.19.2 \
       --accept-tos --email ops@hamloprod.org --dns vercel --pem --path /certs \
       -d db.hamloprod.org renew --days 30 && \
     cp deploy/preview-db/certs/certificates/db.hamloprod.org.crt deploy/preview-db/certs/fullchain.pem && \
     cp deploy/preview-db/certs/certificates/db.hamloprod.org.key deploy/preview-db/certs/privkey.pem && \
     chmod 0644 deploy/preview-db/certs/*.pem && \
     docker kill -s HUP hamloprod-pgbouncer
   ```

   PgBouncer reloads its TLS material on `SIGHUP` — no downtime.

## Option B — HTTP-01 through the host Caddy (fallback)

If the Vercel token route is not acceptable, after the A record is live:

1. **Owner** adds to `/etc/caddy/Caddyfile` (needs root):

   ```
   db.hamloprod.org {
       respond "hamloprod db endpoint" 200
   }
   ```

   `systemctl reload caddy`. Caddy obtains + auto-renews the cert via HTTP-01 and
   stores it under
   `/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/db.hamloprod.org/`.

2. Give the container read access to Caddy's copy (root, one time):

   ```
   install -d -o 70 -g 70 /home/deploy/projects/hamloprod-web/deploy/preview-db/certs
   # a small root cron that copies on change + HUPs pgbouncer:
   */30 * * * * install -m1 -o70 -g70 \
     /var/lib/caddy/.local/share/caddy/.../db.hamloprod.org/db.hamloprod.org.crt \
     /home/deploy/projects/hamloprod-web/deploy/preview-db/certs/fullchain.pem && \
     install -m1 -o70 -g70 \
     /var/lib/caddy/.local/share/caddy/.../db.hamloprod.org/db.hamloprod.org.key \
     /home/deploy/projects/hamloprod-web/deploy/preview-db/certs/privkey.pem && \
     docker kill -s HUP hamloprod-pgbouncer
   ```

Option A keeps everything in the project and off the shared host Caddy — prefer it.

## Verifying the presented cert

```
openssl s_client -starttls postgres -connect db.hamloprod.org:6432 \
  -servername db.hamloprod.org </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

Issuer must be a real Let's Encrypt intermediate; SAN must include
`db.hamloprod.org`; `notAfter` in the future.
