# PostgreSQL TLS + `hostssl`-only — Phase 2 (required before production)

For the **Preview** milestone, client TLS terminates at PgBouncer and the
PgBouncer→Postgres hop stays on the isolated `hamloprod_default` docker bridge
(`server_tls_sslmode = prefer`). That is acceptable for a preview but not for
production. Phase 2 turns on Postgres TLS and refuses non-TLS connections.

## 1. Server key/cert for the container

Postgres runs as uid 999 in `postgres:16`. Put a cert where the container can
read it with `0600`/uid-999:

```
mkdir -p /home/deploy/app-data/hamloprod/pgtls
# reuse the Let's Encrypt material issued for db.hamloprod.org, or an internal CA:
cp deploy/preview-db/certs/fullchain.pem /home/deploy/app-data/hamloprod/pgtls/server.crt
cp deploy/preview-db/certs/privkey.pem   /home/deploy/app-data/hamloprod/pgtls/server.key
sudo chown 999:999 /home/deploy/app-data/hamloprod/pgtls/server.*
sudo chmod 600 /home/deploy/app-data/hamloprod/pgtls/server.key
```

## 2. Compose additions (base `docker-compose.yml`, Phase 2 edit)

```yaml
    command:
      - postgres
      - "-c"
      - "max_connections=40"
      # ... existing tuning ...
      - "-c"
      - "ssl=on"
      - "-c"
      - "ssl_cert_file=/etc/postgresql/tls/server.crt"
      - "-c"
      - "ssl_key_file=/etc/postgresql/tls/server.key"
      - "-c"
      - "hba_file=/etc/postgresql/pg_hba.conf"
    volumes:
      - ./prisma/docker/initdb:/docker-entrypoint-initdb.d:ro
      - /home/deploy/app-data/hamloprod/pgdata:/var/lib/postgresql/data
      - /home/deploy/app-data/hamloprod/pgtls:/etc/postgresql/tls:ro
      - ./deploy/preview-db/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
```

## 3. `pg_hba.conf` (create `deploy/preview-db/pg_hba.conf`)

```
# TYPE   DATABASE     USER                ADDRESS            METHOD
local    all          postgres                               peer
# migrator: only from the host loopback publish (127.0.0.1:55434) / SSH tunnel
hostssl  hamloprod    hamloprod_migrator  127.0.0.1/32       scram-sha-256
hostssl  hamloprod    hamloprod_migrator  ::1/128            scram-sha-256
# app role: only from the PgBouncer container's subnet on hamloprod_default
hostssl  hamloprod    hamloprod_app       172.16.0.0/12      scram-sha-256
# no plaintext "host" lines: every non-local connection must be TLS
```

Pin the PgBouncer subnet precisely with
`docker network inspect hamloprod_default -f '{{(index .IPAM.Config 0).Subnet}}'`
and replace `172.16.0.0/12`.

## 4. Flip PgBouncer to verified server TLS

`deploy/preview-db/pgbouncer.ini`:

```
server_tls_sslmode = verify-full
server_tls_ca_file = /etc/pgbouncer/certs/fullchain.pem
```

## 5. Verify

```
docker exec hamloprod-postgres psql -U postgres -d hamloprod -c "SHOW ssl"        # on
# non-TLS must now fail:
docker run --rm --network hamloprod_default postgres:16 \
  psql "postgresql://hamloprod_app:x@postgres:5432/hamloprod?sslmode=disable" -c 'select 1' ; echo "exit=$?"   # non-zero
```

## Rollback

Remove the `ssl=*` / `hba_file` command lines and the two extra volume mounts,
`docker compose up -d postgres`. The bind-mounted `pgdata` is untouched.
