#!/usr/bin/env bash
# HamloProd — verified PostgreSQL backup: custom-format dump + manifest + checksums.
# roadmap_v2.md §15 (PostgreSQL: pg_dump -Fc daily, 7/4/3 retention, off-box copy).
# Adapted from the Titanor Time R01 pattern.
#
# One backup = one directory:
#   <BACKUP_ROOT>/<env>-<UTC>-<reason>/
#     db.dump          pg_dump -F c   (restore with pg_restore --no-owner --no-acl)
#     db.toc.txt       pg_restore --list of the dump  (proves the archive parses)
#     structure.txt    migrations / table / routine / trigger / FK / index counts (NO row content)
#     row-counts.txt   exact count(*) per public table                 (NO row content)
#     migration-history.sha256   sha256 of (migration_name||' '||checksum ORDER BY name) — stable across restore
#     data.sha256      deterministic order-independent all-data fingerprint (never written elsewhere)
#     manifest.txt     env, UTC, host, git SHA/branch, image, sizes, counts, hashes
#     SHA256SUMS       sha256 of every file above
#     uploads.empty    HamloProd media lives in Contabo, not on the box — always empty here
#
# Env vars (so the SAME script serves any env):
#   HP_ENV            label in filenames + manifest        (default: production)
#   HP_DB_CONTAINER   docker container running PostgreSQL   (default: hamloprod-postgres)
#   HP_DB_USER        role used for pg_dump (local socket) (default: postgres  — complete dump)
#   HP_DB_NAME        (default: hamloprod)
#   HP_APP_CONTAINER  running app container for the image tag (optional; Vercel-hosted → usually none)
#   HP_REPO_DIR       repo checkout for the git SHA          (default: this script's repo)
#   HP_BACKUP_ROOT    on-box backup dir                     (default: /home/deploy/backups/hamloprod)
#   HP_MIRROR_ROOT    off-box copy; "" disables            (default: /mnt/250gb/hamloprod/backups)
#   HP_KEEP_DAILY / HP_KEEP_WEEKLY / HP_KEEP_MONTHLY        (default: 7 / 4 / 3)
#   HP_KEEP_EVENT_DAYS  keep pre-deploy/pre-migration/manual backups this long (default: 30)
#   HP_DATA_HASH     "1" to compute data.sha256 (default 1)
#
# Arg 1 = reason: scheduled | pre-deploy | pre-migration | manual   (default: scheduled)
# Exit: 0 OK · 1 failure · 3 another run holds the lock
# NEVER prints row content, secrets, DATABASE_URL, tokens, email or PII.

set -euo pipefail

HP_ENV="${HP_ENV:-production}"
HP_DB_CONTAINER="${HP_DB_CONTAINER:-hamloprod-postgres}"
HP_DB_USER="${HP_DB_USER:-postgres}"
HP_DB_NAME="${HP_DB_NAME:-hamloprod}"
HP_APP_CONTAINER="${HP_APP_CONTAINER:-}"
HP_REPO_DIR="${HP_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HP_BACKUP_ROOT="${HP_BACKUP_ROOT:-/home/deploy/backups/hamloprod}"
HP_MIRROR_ROOT="${HP_MIRROR_ROOT:-/mnt/250gb/hamloprod/backups}"
HP_KEEP_DAILY="${HP_KEEP_DAILY:-7}"
HP_KEEP_WEEKLY="${HP_KEEP_WEEKLY:-4}"
HP_KEEP_MONTHLY="${HP_KEEP_MONTHLY:-3}"
HP_KEEP_EVENT_DAYS="${HP_KEEP_EVENT_DAYS:-30}"
PG_IMAGE="${HP_PG_IMAGE:-postgres:16}"

REASON="${1:-scheduled}"
case "$REASON" in scheduled|pre-deploy|pre-migration|manual) ;; *) echo "invalid reason: $REASON" >&2; exit 1;; esac

UTC="$(date -u +%Y%m%dT%H%M%SZ)"
LOCKFILE="/tmp/hamloprod-backup-${HP_ENV}.lock"
LP="[backup ${HP_ENV} ${REASON} ${UTC}]"
log()  { echo "${LP} $*"; }
warn() { echo "${LP} WARNING: $*" >&2; }
fail() { echo "${LP} FAILED: $*" >&2; exit 1; }

mkdir -p "$HP_BACKUP_ROOT"
exec 9>"$LOCKFILE"
flock -n 9 || { echo "${LP} another backup for ${HP_ENV} is already running" >&2; exit 3; }

docker inspect "$HP_DB_CONTAINER" >/dev/null 2>&1 || fail "db container '${HP_DB_CONTAINER}' not found"
docker exec "$HP_DB_CONTAINER" pg_isready -U "$HP_DB_USER" -d "$HP_DB_NAME" -q || fail "database not ready"

STAGE="$(mktemp -d "${HP_BACKUP_ROOT}/.stage-${UTC}.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
FINAL="${HP_BACKUP_ROOT}/${HP_ENV}-${UTC}-${REASON}"
[ -e "$FINAL" ] && fail "target already exists: $FINAL"

# --- 1. DB dump ---
log "pg_dump ${HP_DB_NAME} (custom format, role ${HP_DB_USER})"
docker exec "$HP_DB_CONTAINER" pg_dump -U "$HP_DB_USER" -d "$HP_DB_NAME" -F c > "$STAGE/db.dump" || fail "pg_dump"
[ -s "$STAGE/db.dump" ] || fail "dump is empty"

log "validate: pg_restore --list"
docker run --rm -v "${STAGE}:/stage:ro" "$PG_IMAGE" pg_restore --list /stage/db.dump > "$STAGE/db.toc.txt" \
  || fail "dump does not parse with pg_restore --list"
TOC_ENTRIES="$(grep -cE '^[0-9]+;' "$STAGE/db.toc.txt" || true)"
[ "${TOC_ENTRIES:-0}" -gt 0 ] || fail "dump TOC is empty"

# --- 2. no local uploads (Contabo) ---
: > "$STAGE/uploads.empty"

# --- 3. structure + row counts (no row content) ---
docker exec "$HP_DB_CONTAINER" psql -U "$HP_DB_USER" -d "$HP_DB_NAME" -tAX -F= -c "
  SELECT 'migrations_applied',    count(*) FILTER (WHERE finished_at IS NOT NULL) FROM _prisma_migrations
  UNION ALL SELECT 'migrations_unfinished', count(*) FILTER (WHERE finished_at IS NULL)     FROM _prisma_migrations
  UNION ALL SELECT 'migrations_rolledback', count(*) FILTER (WHERE rolled_back_at IS NOT NULL) FROM _prisma_migrations
  UNION ALL SELECT 'public_tables',   count(*) FROM information_schema.tables      WHERE table_schema='public' AND table_type='BASE TABLE'
  UNION ALL SELECT 'public_routines', count(*) FROM information_schema.routines    WHERE routine_schema='public'
  UNION ALL SELECT 'triggers',        count(*) FROM pg_trigger WHERE NOT tgisinternal
  UNION ALL SELECT 'foreign_keys',    count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'
  UNION ALL SELECT 'check_constraints', count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='CHECK'
  UNION ALL SELECT 'indexes',         count(*) FROM pg_indexes WHERE schemaname='public'
" > "$STAGE/structure.txt" || fail "structure query"

COUNT_SQL="$(docker exec "$HP_DB_CONTAINER" psql -U "$HP_DB_USER" -d "$HP_DB_NAME" -tAc \
  "SELECT string_agg(format('SELECT %L t, count(*) c FROM %I.%I', tablename, schemaname, tablename), ' UNION ALL ')
   FROM pg_tables WHERE schemaname='public'")"
[ -n "$COUNT_SQL" ] || fail "could not build row-count query"
docker exec "$HP_DB_CONTAINER" psql -U "$HP_DB_USER" -d "$HP_DB_NAME" -tAX -F= -c \
  "SELECT t, c FROM ($COUNT_SQL) x ORDER BY t" > "$STAGE/row-counts.txt" || fail "row-count query"
ROWS_TOTAL="$(awk -F= '{s+=$2} END{print s+0}' "$STAGE/row-counts.txt")"

MIGRATIONS_APPLIED="$(awk -F= '$1=="migrations_applied"{print $2}' "$STAGE/structure.txt")"
MIGRATIONS_BAD="$(awk -F= '$1=="migrations_unfinished"||$1=="migrations_rolledback"{s+=$2} END{print s+0}' "$STAGE/structure.txt")"
[ "${MIGRATIONS_BAD:-0}" -eq 0 ] || fail "database has ${MIGRATIONS_BAD} unfinished/rolled-back migrations — refusing to record a broken backup"

docker exec "$HP_DB_CONTAINER" psql -U "$HP_DB_USER" -d "$HP_DB_NAME" -tAc \
  "SELECT migration_name||' '||checksum FROM _prisma_migrations ORDER BY migration_name" \
  | sha256sum | awk '{print $1}' > "$STAGE/migration-history.sha256" || fail "migration-history hash"

if [ "${HP_DATA_HASH:-1}" = "1" ]; then
  log "compute order-independent all-data fingerprint"
  docker exec "$HP_DB_CONTAINER" pg_dump -U "$HP_DB_USER" -d "$HP_DB_NAME" --data-only --inserts --no-owner 2>/dev/null \
    | grep -vE '^\\(un)?restrict ' \
    | LC_ALL=C sort \
    | sha256sum | awk '{print $1}' > "$STAGE/data.sha256" || fail "all-data fingerprint"
fi

# --- 4. manifest ---
APP_IMAGE="$( [ -n "$HP_APP_CONTAINER" ] && docker inspect --format '{{.Config.Image}} ({{.Image}})' "$HP_APP_CONTAINER" 2>/dev/null || echo 'vercel-hosted' )"
GIT_SHA="$(git -C "$HP_REPO_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git -C "$HP_REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
GIT_DIRTY="$(git -C "$HP_REPO_DIR" status --porcelain 2>/dev/null | grep -cv -E '\.vscode|LICENSEMAKER|roadmap_v2' || true)"
{
  echo "environment          = ${HP_ENV}"
  echo "reason               = ${REASON}"
  echo "utc_timestamp        = ${UTC}"
  echo "host                 = $(hostname)"
  echo "db_container          = ${HP_DB_CONTAINER}"
  echo "db_name               = ${HP_DB_NAME}"
  echo "app_image             = ${APP_IMAGE}"
  echo "git_branch            = ${GIT_BRANCH}"
  echo "git_sha               = ${GIT_SHA}"
  echo "git_uncommitted_files = ${GIT_DIRTY}"
  echo "dump_bytes            = $(stat -c%s "$STAGE/db.dump")"
  echo "dump_toc_entries      = ${TOC_ENTRIES}"
  echo "uploads_files         = 0"
  echo "uploads_bytes         = 0"
  echo "public_row_total      = ${ROWS_TOTAL}"
  echo "migrations_applied    = ${MIGRATIONS_APPLIED}"
  echo "migration_history_sha256 = $(cat "$STAGE/migration-history.sha256")"
  [ -f "$STAGE/data.sha256" ] && echo "all_data_sha256       = $(cat "$STAGE/data.sha256")"
  echo "--- structure ---"
  cat "$STAGE/structure.txt"
} > "$STAGE/manifest.txt"

# --- 5. checksums ---
( cd "$STAGE" && sha256sum -- * > SHA256SUMS.tmp && mv SHA256SUMS.tmp SHA256SUMS ) || fail "checksums"

# --- 6. atomic publish ---
mv "$STAGE" "$FINAL"
trap - EXIT
chmod 0700 "$FINAL"
chmod 0600 "$FINAL"/*
log "published ${FINAL} (dump $(stat -c%s "$FINAL/db.dump") bytes, ${TOC_ENTRIES} TOC, ${ROWS_TOTAL} rows, ${MIGRATIONS_APPLIED} migrations)"

# --- 7. off-box mirror (non-fatal) ---
if [ -n "$HP_MIRROR_ROOT" ]; then
  if mkdir -p "${HP_MIRROR_ROOT}" 2>/dev/null && cp -a "$FINAL" "${HP_MIRROR_ROOT}/" 2>/dev/null; then
    if ( cd "${HP_MIRROR_ROOT}/$(basename "$FINAL")" && sha256sum --quiet -c SHA256SUMS ) 2>/dev/null; then
      log "off-box mirror OK: ${HP_MIRROR_ROOT}/$(basename "$FINAL")"
    else
      warn "off-box mirror copied but checksum re-verify FAILED — treat the off-box copy as unusable"
    fi
  else
    warn "off-box mirror to ${HP_MIRROR_ROOT} failed (on-box backup is intact)"
  fi
fi

# --- 8. rotation (7 daily / 4 weekly / 3 monthly; events kept by age) ---
prune() {
  local root="$1"; [ -d "$root" ] || return 0
  local -a sched
  mapfile -t sched < <(find "$root" -maxdepth 1 -type d -name "${HP_ENV}-*-scheduled" -printf '%f\n' | sort -r)
  local -A keep=(); local f day wk mo i=0 wk_used=0 mo_used=0
  declare -A wk_seen=() mo_seen=()
  for f in "${sched[@]}"; do
    day="${f#"${HP_ENV}"-}"; day="${day%%T*}"
    if [ "$i" -lt "$HP_KEEP_DAILY" ]; then keep["$f"]=1; i=$((i+1)); continue; fi
    wk="$(date -u -d "${day:0:4}-${day:4:2}-${day:6:2}" +%G-%V 2>/dev/null || echo "raw-$day")"
    mo="${day:0:6}"
    if [ -z "${wk_seen[$wk]:-}" ] && [ "$wk_used" -lt "$HP_KEEP_WEEKLY" ]; then keep["$f"]=1; wk_seen[$wk]=1; wk_used=$((wk_used+1)); continue; fi
    if [ -z "${mo_seen[$mo]:-}" ] && [ "$mo_used" -lt "$HP_KEEP_MONTHLY" ]; then keep["$f"]=1; mo_seen[$mo]=1; mo_used=$((mo_used+1)); continue; fi
  done
  for f in "${sched[@]}"; do [ -n "${keep[$f]:-}" ] || { log "rotate: remove $f"; rm -rf -- "${root:?}/$f"; }; done
  while IFS= read -r f; do log "rotate: remove $(basename "$f")"; rm -rf -- "$f"; done < <(
    find "$root" -maxdepth 1 -type d \
      \( -name "${HP_ENV}-*-pre-deploy" -o -name "${HP_ENV}-*-pre-migration" -o -name "${HP_ENV}-*-manual" \) \
      -mtime "+${HP_KEEP_EVENT_DAYS}")
}
prune "$HP_BACKUP_ROOT"

echo "${LP} OK"
