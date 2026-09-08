-- HamloProd — per-role connection budget (M1.3).
-- Run once against the RUNNING database as a superuser; also folded into
-- prisma/docker/initdb/00-roles.sh for fresh setups.
--
--   docker exec -i hamloprod-postgres psql -U postgres -d postgres \
--     < deploy/preview-db/01-connection-limits.sql
--
-- Rationale: Postgres runs with max_connections=40. PgBouncer (transaction
-- pooling) needs only default_pool_size + reserve_pool_size (~12). Capping the
-- app role keeps a runaway client pool from starving local ops and migrations.
-- The migrator is capped low because it should only ever hold one migration
-- connection at a time.

ALTER ROLE hamloprod_app CONNECTION LIMIT 20;
ALTER ROLE hamloprod_migrator CONNECTION LIMIT 4;

SELECT rolname, rolconnlimit FROM pg_roles WHERE rolname LIKE 'hamloprod%' ORDER BY rolname;
