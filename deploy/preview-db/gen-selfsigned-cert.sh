#!/usr/bin/env bash
# HamloProd — self-signed cert for db.hamloprod.org (M1.3).
#
# Use ONLY for loopback verification of the PgBouncer plumbing. A Vercel Preview
# needs a real Let's Encrypt certificate (deploy/preview-db/issue-cert.md) so that
# sslmode=verify-full validates against the system trust store.
#
# Writes into deploy/preview-db/certs/:
#   ca.pem          local test CA (pass this as ?sslrootcert=... for verify-full)
#   fullchain.pem   server cert + CA, what PgBouncer presents
#   privkey.pem     server private key (chmod 0644 so container uid 70 can read)
set -euo pipefail

HOST="${1:-db.hamloprod.org}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/certs"
DAYS=90
mkdir -p "$DIR"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days "$DAYS" \
  -keyout "$tmp/ca.key" -out "$tmp/ca.pem" \
  -subj "/CN=HamloProd local test CA" >/dev/null 2>&1

openssl req -newkey rsa:2048 -nodes \
  -keyout "$tmp/srv.key" -out "$tmp/srv.csr" \
  -subj "/CN=$HOST" >/dev/null 2>&1

openssl x509 -req -in "$tmp/srv.csr" -CA "$tmp/ca.pem" -CAkey "$tmp/ca.key" \
  -CAcreateserial -days "$DAYS" \
  -extfile <(printf 'subjectAltName=DNS:%s\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$HOST") \
  -out "$tmp/srv.pem" >/dev/null 2>&1

cp "$tmp/ca.pem" "$DIR/ca.pem"
cat "$tmp/srv.pem" "$tmp/ca.pem" > "$DIR/fullchain.pem"
cp "$tmp/srv.key" "$DIR/privkey.pem"
chmod 0644 "$DIR"/*.pem

echo "wrote $DIR/{ca,fullchain,privkey}.pem for CN=$HOST (self-signed, ${DAYS}d)"
openssl x509 -in "$DIR/fullchain.pem" -noout -subject -issuer -ext subjectAltName -enddate
