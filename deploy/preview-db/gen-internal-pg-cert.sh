#!/usr/bin/env bash
# HamloProd — dedicated internal CA + PostgreSQL server certificate for the
# PgBouncer→PostgreSQL TLS hop (deploy/preview-db/postgres-tls.md).
#
# NOT the public db.hamloprod.org Let's Encrypt cert: PgBouncer connects to the
# docker service name `postgres`, so the server cert's SAN must be `postgres`
# (the LE cert's SAN is only `db.hamloprod.org` → verify-full would fail).
#
# Writes to deploy/preview-db/certs/ (all *.pem are gitignored):
#   pg-internal-ca.pem       the CA — mount into PgBouncer as server_tls_ca_file
#   pg-server.crt/.key       the PostgreSQL server keypair (SAN: postgres, ...)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/certs"
mkdir -p "$DIR"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$tmp/ca.key" -out "$tmp/ca.pem" \
  -subj "/CN=HamloProd internal PgBouncer<->PostgreSQL CA" >/dev/null 2>&1

openssl req -newkey rsa:2048 -nodes -keyout "$tmp/srv.key" -out "$tmp/srv.csr" \
  -subj "/CN=postgres" >/dev/null 2>&1

openssl x509 -req -in "$tmp/srv.csr" -CA "$tmp/ca.pem" -CAkey "$tmp/ca.key" -CAcreateserial -days 825 \
  -extfile <(printf 'subjectAltName=DNS:postgres,DNS:hamloprod-postgres,DNS:localhost,IP:127.0.0.1\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n') \
  -out "$tmp/srv.crt" >/dev/null 2>&1

install -m 0644 "$tmp/ca.pem"  "$DIR/pg-internal-ca.pem"
install -m 0644 "$tmp/srv.crt" "$DIR/pg-server.crt"
install -m 0600 "$tmp/srv.key" "$DIR/pg-server.key"
echo "wrote $DIR/{pg-internal-ca.pem,pg-server.crt,pg-server.key}"
openssl x509 -in "$DIR/pg-server.crt" -noout -subject -ext subjectAltName -enddate
