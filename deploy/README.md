# deploy/

Operational configuration for the self-hosted infrastructure. Nothing here runs
automatically on Vercel — the app on Vercel only reads `DATABASE_URL` etc.

## preview-db/ — Vercel Preview → VPS PostgreSQL link (M1.3)

PgBouncer in front of the self-hosted PostgreSQL so a Vercel Preview can reach the
database over a TLS-only, non-standard, SCRAM-authenticated endpoint without ever
publishing port 5432. Full design, rationale and the owner runbook:
**[../docs/preview-db-connection.md](../docs/preview-db-connection.md)**.

Quick reference:

```
# loopback verification (exposes nothing):
docker compose -f docker-compose.yml \
  -f deploy/preview-db/docker-compose.pgbouncer.yml up -d
DB_CHECK_ADDR=127.0.0.1:6432 DB_CHECK_URL='postgresql://hamloprod_app:<pw>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true' \
  npx tsx scripts/db-connection-check.mts

# tear down (leaves hamloprod-postgres running):
docker compose -f docker-compose.yml \
  -f deploy/preview-db/docker-compose.pgbouncer.yml rm -sf pgbouncer
```

Committed: `*.yml`, `*.ini`, `*.sql`, `*.md`, `*.example`, `gen-selfsigned-cert.sh`.
Gitignored (created on the VPS): `userlist.txt`, `certs/*`, `*.env`.
