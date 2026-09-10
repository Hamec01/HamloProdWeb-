# PostgreSQL backend TLS (PgBouncer→PostgreSQL) — required before production

Client→PgBouncer TLS is already `verify-full` against the public Let's Encrypt
cert for `db.hamloprod.org` (verified: `scripts/db-connection-check.mts` → 9/9).
This document turns on TLS for the **internal** PgBouncer→PostgreSQL hop and makes
PostgreSQL refuse any non-TLS connection from the docker bridge.

## The SAN problem (why not reuse the LE cert)

PgBouncer's `[databases]` entry is `host=postgres` — the docker service name. A
server cert whose SAN is only `db.hamloprod.org` (the LE cert) fails
`server_tls_sslmode = verify-full`. So the backend hop gets its **own** internal
CA + server cert with `subjectAltName = DNS:postgres`. The traffic never leaves
the isolated `hamloprod_default` bridge, and the cert is purpose-built for it —
this is the ТЗ §6 "отдельный внутренний сертификат/CA с SAN postgres + verify-full"
option.

## Runbook (needs `docker`, not `sudo`)

Run from the repo root on the VPS. Take a verified backup first
(`ops/hamloprod/backup-hamloprod.sh pre-migration` + `restore-test-hamloprod.sh`).

```bash
# 1. internal CA + server cert (SAN: postgres, hamloprod-postgres, localhost, 127.0.0.1)
./deploy/preview-db/gen-internal-pg-cert.sh

# 2. place the keypair + CA inside the data dir (persists via the bind mount).
#    `docker exec` runs as root in postgres:16, so it can write there; then hand
#    ownership to the postgres user and lock the key to 0600.
docker cp deploy/preview-db/certs/pg-server.crt      hamloprod-postgres:/var/lib/postgresql/data/server.crt
docker cp deploy/preview-db/certs/pg-server.key      hamloprod-postgres:/var/lib/postgresql/data/server.key
docker cp deploy/preview-db/certs/pg-internal-ca.pem hamloprod-postgres:/var/lib/postgresql/data/root.crt
docker exec hamloprod-postgres bash -c '
  chown postgres:postgres /var/lib/postgresql/data/server.crt /var/lib/postgresql/data/server.key /var/lib/postgresql/data/root.crt &&
  chmod 600 /var/lib/postgresql/data/server.key &&
  chmod 644 /var/lib/postgresql/data/server.crt /var/lib/postgresql/data/root.crt'

# 3. hba: TLS-only for the bridge. Verify the subnet first, edit pg_hba.conf here
#    if it is not 172.25.0.0/16, then install it into the data dir.
docker network inspect hamloprod_default -f '{{(index .IPAM.Config 0).Subnet}}'
docker cp deploy/preview-db/pg_hba.conf hamloprod-postgres:/var/lib/postgresql/data/pg_hba.conf
docker exec hamloprod-postgres chown postgres:postgres /var/lib/postgresql/data/pg_hba.conf

# 4. turn on ssl (writes postgresql.auto.conf in the data dir — survives recreate)
docker exec hamloprod-postgres psql -U postgres -c "ALTER SYSTEM SET ssl = 'on'"

# 5. restart PostgreSQL (ssl=on needs a restart; ~5s; pgdata untouched)
docker restart hamloprod-postgres
docker exec hamloprod-postgres pg_isready -U postgres -q && echo "postgres up"

# 6. flip PgBouncer to verified backend TLS + recreate it
#    (edit deploy/preview-db/pgbouncer.ini: see the block below)
docker compose -f docker-compose.yml -f deploy/preview-db/docker-compose.pgbouncer.yml \
  up -d --force-recreate pgbouncer
```

`deploy/preview-db/pgbouncer.ini` — change the server-side TLS block to:

```
server_tls_sslmode = verify-full
server_tls_ca_file = /etc/pgbouncer/certs/pg-internal-ca.pem
```

(`docker-compose.pgbouncer.yml` already mounts `deploy/preview-db/certs` at
`/etc/pgbouncer/certs`, so `pg-internal-ca.pem` is picked up automatically.)

## Verify

```bash
docker exec hamloprod-postgres psql -U postgres -d hamloprod -tAc "SHOW ssl"          # -> on

# the pooled path still works, and its backend hop is now TLS:
DB_CHECK_ADDR=127.0.0.1:6432 \
DB_CHECK_URL='postgresql://hamloprod_app:<pw>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true' \
  npx tsx scripts/db-connection-check.mts          # "backend hop TLS … ssl=true"

# a non-TLS client from the bridge is refused:
docker run --rm --network hamloprod_default postgres:16 \
  psql "postgresql://hamloprod_app:x@postgres:5432/hamloprod?sslmode=disable" -c 'select 1'
  # -> FATAL: no pg_hba.conf entry … no encryption
```

## Rollback (TLS config only — never the data)

```bash
docker exec hamloprod-postgres psql -U postgres -c "ALTER SYSTEM SET ssl = 'off'"
# restore the previous pg_hba.conf (a plain `host all all all scram-sha-256` line
# is the postgres:16 default) then:
docker restart hamloprod-postgres
# revert pgbouncer.ini to server_tls_sslmode = prefer, recreate pgbouncer
```

The bind-mounted `pgdata` and every row in it are untouched by any step here.

---

## Status

Not yet applied. The `docker cp`/`docker exec` container-file steps above were
blocked from automated execution in the cutover session (they mutate a running
DB container). They are otherwise ready to run as-is. This is a **STOP-gate for
production** per the ТЗ §6.
