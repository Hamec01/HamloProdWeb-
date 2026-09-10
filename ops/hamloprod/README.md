# ops/hamloprod — PostgreSQL backup + restore verification

Adapted from the Titanor Time R01 pattern. Serves the self-hosted `hamloprod-postgres`
container (`db=hamloprod`). HamloProd media lives in Contabo, not on the box, so
there is no uploads archive (`uploads.empty` is always recorded).

## Scripts

| | |
|---|---|
| `backup-hamloprod.sh [scheduled\|pre-deploy\|pre-migration\|manual]` | `pg_dump -Fc` + `pg_restore --list` validation + structure/row-count/hash manifest + `SHA256SUMS` + atomic publish + off-box mirror (checksum re-verified) + 7/4/3 rotation. Exit 3 = another run holds the flock. Never prints row content / secrets / PII. |
| `restore-test-hamloprod.sh <backup-dir>` | Verifies `SHA256SUMS`, restores into a **disposable** `postgres:16` under a throwaway owner role, compares migrations / structure / per-table row counts / all-data fingerprint to the recorded values, removes every disposable resource by exact name. |

## Install the daily timer (root)

```bash
sudo install -D -m 0644 ops/hamloprod/systemd/hamloprod-backup@.service        /etc/systemd/system/hamloprod-backup@.service
sudo install -D -m 0644 ops/hamloprod/systemd/hamloprod-backup-failed@.service /etc/systemd/system/hamloprod-backup-failed@.service
sudo install -D -m 0644 ops/hamloprod/systemd/hamloprod-backup@.timer          /etc/systemd/system/hamloprod-backup@.timer
sudo install -D -m 0600 -o root -g root ops/hamloprod/systemd/backup-production.env.example /etc/hamloprod/backup-production.env
sudo systemctl daemon-reload
sudo systemctl enable --now hamloprod-backup@production.timer
systemctl list-timers hamloprod-backup@production.timer
```

The timer fires 04:40 UTC daily (after the two Titanor timers). `Persistent=true` catches
missed runs. Failure → `hamloprod-backup-failed@production.service` writes
`/home/deploy/backups/hamloprod/BACKUP_FAILED.log` and a `logger` line.

## Pre-cutover / pre-migration

```bash
HP_REPO_DIR=/home/deploy/projects/hamloprod-web ops/hamloprod/backup-hamloprod.sh pre-migration
ops/hamloprod/restore-test-hamloprod.sh "$(ls -d /home/deploy/backups/hamloprod/production-*-pre-migration | tail -1)"
```

A dump is never considered safe without a passing restore test.
