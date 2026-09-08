# Exposing the PgBouncer port safely (M1.3) — owner action

**Do not** publish port 5432 (Postgres) anywhere but `127.0.0.1`. Only the
PgBouncer container port `6432` may face the internet, and only with the layers
below in place.

## Why a plain `-p` is not enough

`/etc/docker/daemon.json` is absent → Docker inserts its forwarding rules **ahead
of UFW**. A published container port is reachable from the internet **even if UFW
says `deny`**. So exposure is controlled in the `DOCKER-USER` iptables chain, not
UFW.

## Step 1 — bring PgBouncer up bound to all interfaces

```
cd /home/deploy/projects/hamloprod-web
PGBOUNCER_BIND=0.0.0.0 docker compose \
  -f docker-compose.yml -f deploy/preview-db/docker-compose.pgbouncer.yml up -d
```

At this instant `6432` is world-open (TLS + SCRAM only). Do steps 2–3 in the same
maintenance window.

## Step 2 — DOCKER-USER rate-limit + logging (root)

No static Vercel egress IPs on Hobby/Pro, so this is rate-limiting + visibility,
not an allow-list. Add an allow-list block here the day Vercel Secure Compute (or
a static-IP proxy) is in front.

```
# accept established, throttle new conns to :6432, log-and-drop the excess
iptables -I DOCKER-USER  -p tcp --dport 6432 -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -I DOCKER-USER  -p tcp --dport 6432 -m conntrack --ctstate NEW \
    -m hashlimit --hashlimit-name pgb6432 --hashlimit-mode srcip \
    --hashlimit-above 10/min --hashlimit-burst 20 -j LOG --log-prefix "pgb6432-drop "
iptables -A DOCKER-USER  -p tcp --dport 6432 -m conntrack --ctstate NEW \
    -m hashlimit --hashlimit-name pgb6432b --hashlimit-mode srcip \
    --hashlimit-above 10/min --hashlimit-burst 20 -j DROP
```

Persist with `netfilter-persistent save` (or the box's existing mechanism).

Rollback: `iptables -D DOCKER-USER <rule>` for each, or
`iptables -F DOCKER-USER` if nothing else uses that chain (check first —
`iptables -S DOCKER-USER`).

## Step 3 — fail2ban jail on the PgBouncer log (root)

```
# /etc/fail2ban/filter.d/pgbouncer.conf
[Definition]
failregex = ^.*@<HOST>:\d+ (closing because: (client unexpected eof|auth failed)|login failed).*$
            ^.*C-\S+: \S+/\S+@<HOST>:\d+ (pooler error|auth_failed).*$
ignoreregex =
```

```
# /etc/fail2ban/jail.d/pgbouncer.local
[pgbouncer]
enabled  = true
backend  = systemd
journalmatch = CONTAINER_NAME=hamloprod-pgbouncer
filter   = pgbouncer
maxretry = 6
findtime = 10m
bantime  = 1h
action   = iptables-allports[name=pgbouncer]
```

`docker logs` goes to the journal (default `json-file`+journald varies — if the
container is not in the journal, point `logpath` at
`/var/lib/docker/containers/*/*-json.log` for `hamloprod-pgbouncer` instead).
`systemctl restart fail2ban`; check `fail2ban-client status pgbouncer`.

## Verify exposure is as intended

```
# from OUTSIDE the VPS:
nc -vz db.hamloprod.org 6432          # open
nc -vz db.hamloprod.org 5432          # MUST be refused/filtered
openssl s_client -starttls postgres -connect db.hamloprod.org:6432 -servername db.hamloprod.org </dev/null 2>/dev/null | openssl x509 -noout -issuer -ext subjectAltName
```

## Full rollback

```
docker compose -f docker-compose.yml -f deploy/preview-db/docker-compose.pgbouncer.yml down
# remove the DOCKER-USER rules (step 2) and the fail2ban jail (step 3)
```

The base `docker compose up -d` (Postgres only, `127.0.0.1`) is unaffected.
