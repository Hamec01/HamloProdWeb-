#!/usr/bin/env bash
# HamloProd — restore verification of a backup produced by backup-hamloprod.sh.
#
#   ops/hamloprod/restore-test-hamloprod.sh <backup-directory>
#
# Nothing touches the live hamloprod-postgres:
#   1. verify the backup's own SHA256SUMS (from a local staged copy — proves an off-box copy too)
#   2. spin up a DISPOSABLE postgres:16 + fresh volume on its own network
#   3. pg_restore --no-owner --no-acl into a fresh DB owned by a throwaway role (owner-independence)
#   4. compare the RESTORED db to the values RECORDED in the backup:
#        _prisma_migrations applied count + 0 bad + migration-history hash
#        structure.txt: tables / routines / triggers / FKs / checks / indexes
#        row-counts.txt: exact count(*) for every public table
#        data.sha256: order-independent all-data fingerprint
#   5. print PASS/FAIL and remove every disposable resource by exact name
#
# NEVER prints row content, secrets, DATABASE_URL, tokens, email or PII.

set -euo pipefail

BACKUP_DIR="${1:?usage: restore-test-hamloprod.sh <backup-directory>}"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
PG_IMAGE="${HP_PG_IMAGE:-postgres:16}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
SUFFIX="hp-restore-${TS}-$$"
NET="${SUFFIX}-net"; VOL="${SUFFIX}-db"; DBC="${SUFFIX}-db"
WORKDIR="$(mktemp -d "/tmp/${SUFFIX}.XXXXXX")"
TARGET_DB="hp_restore"
TARGET_ROLE="hp_restore_owner"           # deliberately NOT hamloprod_migrator / hamloprod_app
TARGET_PW="$(head -c18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"

pass=0 fail=0
ok()   { pass=$((pass+1)); echo "PASS: $*"; }
bad()  { fail=$((fail+1)); echo "FAIL: $*"; }
info() { echo "---- $*"; }

cleanup() {
  docker rm -f "$DBC" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

info "backup: $BACKUP_DIR"
for f in db.dump db.toc.txt manifest.txt row-counts.txt structure.txt SHA256SUMS migration-history.sha256; do
  [ -f "$BACKUP_DIR/$f" ] || bad "backup is missing $f"
done
STAGED="$WORKDIR/backup"; mkdir -p "$STAGED"; cp -a "$BACKUP_DIR"/. "$STAGED"/
if ( cd "$STAGED" && sha256sum --quiet -c SHA256SUMS ); then ok "backup SHA256SUMS verify (staged from ${BACKUP_DIR})"; else bad "backup SHA256SUMS verify"; fi
BACKUP_DIR="$STAGED"
[ "$fail" -eq 0 ] || { echo; echo "RESTORE TEST FAIL ($fail) — backup is not intact"; exit 1; }

MANI_MIGR="$(awk -F= '/^migrations_applied=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_TABLES="$(awk -F= '/^public_tables=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_ROUTINES="$(awk -F= '/^public_routines=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_TRIGGERS="$(awk -F= '/^triggers=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_FKS="$(awk -F= '/^foreign_keys=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_CHECKS="$(awk -F= '/^check_constraints=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_INDEXES="$(awk -F= '/^indexes=/{gsub(/ /,"");print $2}' "$BACKUP_DIR/structure.txt")"
MANI_MIGR_HASH="$(cat "$BACKUP_DIR/migration-history.sha256")"
MANI_DATA_HASH=""; [ -f "$BACKUP_DIR/data.sha256" ] && MANI_DATA_HASH="$(cat "$BACKUP_DIR/data.sha256")"

info "start disposable ${PG_IMAGE} ($DBC)"
docker network create "$NET" >/dev/null
docker run -d --name "$DBC" --network "$NET" \
  -e POSTGRES_DB="$TARGET_DB" -e POSTGRES_USER="$TARGET_ROLE" -e POSTGRES_PASSWORD="$TARGET_PW" \
  -v "$VOL:/var/lib/postgresql/data" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$DBC" pg_isready -U "$TARGET_ROLE" -d "$TARGET_DB" -q 2>/dev/null && break; sleep 1; done
docker exec "$DBC" pg_isready -U "$TARGET_ROLE" -d "$TARGET_DB" -q || { bad "disposable postgres did not become ready"; exit 1; }

# Prisma dump also references the citext extension — it is in the default image. Restore it first
# if the dump does not (pg_restore recreates extensions from the dump when present).
info "pg_restore --no-owner --no-acl into ${TARGET_DB} (owner ${TARGET_ROLE})"
if docker run --rm --network "$NET" -v "$BACKUP_DIR:/b:ro" -e PGPASSWORD="$TARGET_PW" "$PG_IMAGE" \
     pg_restore --no-owner --no-acl --exit-on-error -h "$DBC" -U "$TARGET_ROLE" -d "$TARGET_DB" /b/db.dump 2>"$WORKDIR/restore.err"; then
  ok "pg_restore completed with --exit-on-error"
else
  bad "pg_restore failed"; sed 's/^/    /' "$WORKDIR/restore.err" | head -20
fi

q() { docker exec "$DBC" psql -U "$TARGET_ROLE" -d "$TARGET_DB" -tAc "$1"; }

R_MIGR="$(q "SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) FROM _prisma_migrations")"
R_BAD="$(q "SELECT count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) FROM _prisma_migrations")"
R_MIGR_HASH="$(q "SELECT migration_name||' '||checksum FROM _prisma_migrations ORDER BY migration_name" | sha256sum | awk '{print $1}')"
[ "$R_MIGR" = "$MANI_MIGR" ] && ok "migrations applied: $R_MIGR (== backup)" || bad "migrations applied: restored $R_MIGR vs backup $MANI_MIGR"
[ "${R_BAD:-1}" -eq 0 ] && ok "no unfinished/rolled-back migrations in the restore" || bad "$R_BAD bad migrations after restore"
[ "$R_MIGR_HASH" = "$MANI_MIGR_HASH" ] && ok "migration-history hash matches" || bad "migration-history hash mismatch"

R_TABLES="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
R_ROUTINES="$(q "SELECT count(*) FROM information_schema.routines WHERE routine_schema='public'")"
R_TRIGGERS="$(q "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal")"
R_FKS="$(q "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'")"
R_CHECKS="$(q "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='CHECK'")"
R_INDEXES="$(q "SELECT count(*) FROM pg_indexes WHERE schemaname='public'")"
[ "$R_TABLES" = "$MANI_TABLES" ]     && ok "public tables: $R_TABLES"     || bad "public tables: restored $R_TABLES vs backup $MANI_TABLES"
[ "$R_ROUTINES" = "$MANI_ROUTINES" ] && ok "public routines: $R_ROUTINES" || bad "public routines: restored $R_ROUTINES vs backup $MANI_ROUTINES"
[ "$R_TRIGGERS" = "$MANI_TRIGGERS" ] && ok "triggers: $R_TRIGGERS"        || bad "triggers: restored $R_TRIGGERS vs backup $MANI_TRIGGERS"
[ "$R_FKS" = "$MANI_FKS" ]           && ok "foreign keys: $R_FKS"         || bad "foreign keys: restored $R_FKS vs backup $MANI_FKS"
[ "$R_CHECKS" = "$MANI_CHECKS" ]     && ok "check constraints: $R_CHECKS" || bad "check constraints: restored $R_CHECKS vs backup $MANI_CHECKS"
[ "$R_INDEXES" = "$MANI_INDEXES" ]   && ok "indexes: $R_INDEXES"          || bad "indexes: restored $R_INDEXES vs backup $MANI_INDEXES"

COUNT_SQL="$(q "SELECT string_agg(format('SELECT %L t, count(*) c FROM %I.%I', tablename, schemaname, tablename), ' UNION ALL ') FROM pg_tables WHERE schemaname='public'")"
q "SELECT t, c FROM ($COUNT_SQL) x ORDER BY t" | tr '|' '=' > "$WORKDIR/restored-row-counts.txt"
awk -F'[|=]' '{print $1"="$2}' "$BACKUP_DIR/row-counts.txt" | sort > "$WORKDIR/backup-rc.norm"
awk -F'[|=]' '{print $1"="$2}' "$WORKDIR/restored-row-counts.txt" | sort > "$WORKDIR/restored-rc.norm"
if diff -u "$WORKDIR/backup-rc.norm" "$WORKDIR/restored-rc.norm" > "$WORKDIR/rc.diff"; then
  ok "per-table row counts identical for all $(wc -l < "$WORKDIR/backup-rc.norm") public tables"
else
  bad "per-table row counts differ:"; sed 's/^/    /' "$WORKDIR/rc.diff" | head -30
fi

if [ -n "$MANI_DATA_HASH" ]; then
  R_DATA_HASH="$(docker exec "$DBC" pg_dump -U "$TARGET_ROLE" -d "$TARGET_DB" --data-only --inserts --no-owner 2>/dev/null \
    | grep -vE '^\\(un)?restrict ' | LC_ALL=C sort | sha256sum | awk '{print $1}')"
  [ "$R_DATA_HASH" = "$MANI_DATA_HASH" ] && ok "all-data fingerprint matches the backup exactly" || bad "all-data fingerprint mismatch"
else
  info "no data.sha256 in backup — skipping all-data fingerprint check"
fi

echo
echo "RESTORE TEST: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ] || exit 1
echo "PASS"
