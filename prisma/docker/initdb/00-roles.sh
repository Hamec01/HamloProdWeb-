#!/bin/bash
# One-time first-start init, run as the bootstrap superuser ($POSTGRES_USER =
# "postgres") against the default "postgres" database.
#
# Creates two NON-superuser login roles and the application database:
#
#   hamloprod_migrator  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
#                       owns the application DB and its "public" schema;
#                       Prisma migrations connect as this role (DIRECT_URL).
#   hamloprod_app       LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
#                       CONNECT + USAGE + DML only; cannot CREATE/ALTER/DROP.
#                       The application connects as this role (DATABASE_URL).
#
# A dedicated shadow database (owned by the migrator) is created so
# `prisma migrate dev` works even though the migrator cannot CREATE DATABASE.
set -euo pipefail

: "${MIGRATOR_DB_USER:?MIGRATOR_DB_USER is required}"
: "${MIGRATOR_DB_PASSWORD:?MIGRATOR_DB_PASSWORD is required}"
: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
APP_DB_NAME="${APP_DB_NAME:-hamloprod}"
SHADOW_DB_NAME="${APP_DB_NAME}_shadow"

# --- roles + databases (connected to the bootstrap "postgres" database) ---
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set mig_user="$MIGRATOR_DB_USER" --set mig_pw="$MIGRATOR_DB_PASSWORD" \
  --set app_user="$APP_DB_USER" --set app_pw="$APP_DB_PASSWORD" \
  --set db_name="$APP_DB_NAME" --set shadow_name="$SHADOW_DB_NAME" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'mig_user', :'mig_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'mig_user')
\gexec

SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'app_user', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- Bounded connection budget (M1.3): Postgres runs max_connections=40; the app
-- role is reached through PgBouncer (transaction pooling) and the migrator holds
-- at most one migration connection. Caps keep a runaway pool from starving
-- local ops. Mirrors deploy/preview-db/01-connection-limits.sql for running DBs.
SELECT format('ALTER ROLE %I CONNECTION LIMIT 20', :'app_user')  \gexec
SELECT format('ALTER ROLE %I CONNECTION LIMIT 4',  :'mig_user') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'mig_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'shadow_name', :'mig_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'shadow_name')
\gexec

REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"mig_user";
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
REVOKE ALL ON DATABASE :"shadow_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"shadow_name" TO :"mig_user";
SQL

# --- schema ownership + privileges (per database, connected as superuser) ---
for target in "$APP_DB_NAME" "$SHADOW_DB_NAME"; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$target" \
    --set mig_user="$MIGRATOR_DB_USER" --set app_user="$APP_DB_USER" <<'SQL'
ALTER SCHEMA public OWNER TO :"mig_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO :"mig_user";
GRANT USAGE ON SCHEMA public TO :"app_user";

-- Objects the migrator creates later become DML-usable by the app role.
ALTER DEFAULT PRIVILEGES FOR ROLE :"mig_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"mig_user" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL
done

echo "init: roles '$MIGRATOR_DB_USER' (owner) and '$APP_DB_USER' (DML only) ready; databases '$APP_DB_NAME' + '$SHADOW_DB_NAME' created"
