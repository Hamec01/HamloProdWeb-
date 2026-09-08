# PostgreSQL foundation — M1.2 / M1.2a

Статус: выполнено (с исправлениями M1.2a). Ветка `migration/self-hosted-backend`.
Основание: `roadmap_v2.md` (§16 M1), `docs/infrastructure-audit.md` (§12),
`docs/migration-from-supabase.md`.

Решение (окончательное, от пользователя):

- Supabase недоступен; **данные и файлы из Supabase не переносятся**;
- создаётся **чистая** PostgreSQL; контент будет загружен заново;
- **новый код не использует Supabase**; старые Supabase-файлы/пакеты удаляются
  постепенно, по мере замены маршрутов.

M1.2a — correction поверх `912524a`: не-superuser роли, обязательный bind mount,
лимиты ресурсов, доработка схемы (`User`, `Beat`, `UploadIntent`), backend-дефолты.

---

## 1. Файлы

| Файл | Назначение |
|---|---|
| [docker-compose.yml](../docker-compose.yml) | PostgreSQL 16; порт **только** `127.0.0.1:${POSTGRES_HOST_PORT:-55434}:5432`; bootstrap superuser `postgres` (локально); лимиты (`mem_limit 768m`, `shm_size 256mb`, `max_connections=40`, `shared_buffers=256MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`); healthcheck; `restart: unless-stopped` |
| [prisma/docker/initdb/00-roles.sh](../prisma/docker/initdb/00-roles.sh) | one-time init как `postgres`: создаёт роли `hamloprod_migrator` / `hamloprod_app` (обе `NOSUPERUSER NOCREATEDB NOCREATEROLE`), БД `hamloprod` + `hamloprod_shadow` (владелец — migrator), права схемы, `ALTER DEFAULT PRIVILEGES` |
| [prisma/schema.prisma](../prisma/schema.prisma) | datasource (`url`/`directUrl`/`shadowDatabaseUrl`, extension `citext`), 7 enum, 4 модели |
| [prisma/migrations/20260906190659_init/migration.sql](../prisma/migrations/20260906190659_init/migration.sql) | начальная миграция (заменяет прежнюю `20260906182235_init`); `CREATE EXTENSION citext`, enums, tables, indexes, FK, CHECK нормализации email |
| [prisma/migrations/migration_lock.toml](../prisma/migrations/migration_lock.toml) | `provider = "postgresql"` |
| [src/lib/db/client.ts](../src/lib/db/client.ts) | singleton `PrismaClient` |
| [src/lib/db/config.ts](../src/lib/db/config.ts) + [config.test.ts](../src/lib/db/config.test.ts) | server-only проверка `DATABASE_URL` |
| [src/lib/storage/config.ts](../src/lib/storage/config.ts) | `getStorageBackend`: `contabo-s3` — цель, пусто ⇒ `contabo-s3`, `supabase` пока принимается, прочее — ошибка |
| [.env.example](../.env.example) | `DATA_BACKEND=postgres`, `STORAGE_BACKEND=contabo-s3`, новые PG-переменные; только пустые значения |

Зависимости: `prisma` / `@prisma/client` — `6.19.3` (закреплено; `prisma@latest` в
npm = `8.0.0-rc`, а Prisma 7 убрал `url`/`directUrl` из schema).

---

## 2. Роли PostgreSQL

| Роль | Атрибуты | Использование |
|---|---|---|
| `postgres` | SUPERUSER (bootstrap) | только локальный сокет / init-скрипт. **Не** в `DATABASE_URL` / `DIRECT_URL` |
| `hamloprod_migrator` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; владелец БД `hamloprod` и схемы `public` | `DIRECT_URL` — только `prisma migrate` |
| `hamloprod_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; `CONNECT`, `USAGE ON SCHEMA public`, DML на таблицах (через `ALTER DEFAULT PRIVILEGES`). `CREATE` на схеме не выдан | `DATABASE_URL` — runtime (`src/lib/db/client.ts`) |

Проверено (без вывода паролей):

```
rolname             super createdb createrole canlogin replication bypassrls
hamloprod_app       f     f        f          t        f           f
hamloprod_migrator  f     f        f          t        f           f
postgres            t     t        t          t        t           t
```

- `hamloprod_app`: `INSERT/UPDATE/DELETE/SELECT` — ок; `CREATE TABLE` → *permission
  denied for schema public*; `ALTER TABLE` / `DROP TABLE` → *must be owner*.
- `hamloprod_migrator`: `is_superuser=false`; `CREATE/DROP TABLE` — ок;
  `CREATE ROLE` → *Only roles with the CREATEROLE attribute*; `CREATE DATABASE` →
  *permission denied to create database*.

Shadow DB: migrator не может `CREATE DATABASE`, поэтому `hamloprod_shadow`
(владелец — migrator) создаётся init-скриптом; `SHADOW_DATABASE_URL` нужен только
для `prisma migrate dev` (dev-инструмент), не для рантайма и не для `migrate deploy`.

---

## 3. Persistent storage

Обязательный **bind mount**:

```
/home/deploy/app-data/hamloprod/pgdata  ->  /var/lib/postgresql/data
```

Named volume больше не используется. Каталог создаётся до первого `up`
(`mkdir -p`). При переносе/деплое на другой хост путь тот же (соглашение VPS
`/home/deploy/app-data/<project>/`).

Перед пересозданием БД проверено: `users=0, beats=0, sessions=0,
upload_intents=0` — реальных пользователей/битов нет, только тестовые вставки,
которые удалены. Данные пересозданы с нуля.

---

## 4. Лимиты контейнера (`docker inspect`, без секретов)

```
Mounts:
  bind  /home/deploy/projects/hamloprod-web/prisma/docker/initdb -> /docker-entrypoint-initdb.d  (ro)
  bind  /home/deploy/app-data/hamloprod/pgdata                    -> /var/lib/postgresql/data     (rw)
HostConfig.Memory   : 805306368 bytes  (768 MiB)
HostConfig.ShmSize  : 268435456 bytes  (256 MiB)
PortBindings        : {"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"55434"}]}
RestartPolicy       : unless-stopped
Cmd                 : postgres -c max_connections=40 -c shared_buffers=256MB
                      -c effective_cache_size=512MB -c work_mem=4MB -c maintenance_work_mem=64MB
```

`pg_settings` в работающей БД: `max_connections=40`, `shared_buffers=256MB`,
`work_mem=4MB`, `maintenance_work_mem=64MB`, `effective_cache_size=512MB`.
Хост слушает `LISTEN 127.0.0.1:55434` и **не** `0.0.0.0` / `[::]`.

---

## 5. Модель данных

Native Postgres enums; `snake_case` через `@@map`/`@map`; `timestamptz(6)` UTC;
PK `uuid` через `gen_random_uuid()`; `created_at`/`updated_at` с DB-default `now()`.

### User / `users`
- `email` — тип **`CITEXT`**, `UNIQUE` → уникальность нормализованного email
  гарантируется базой (регистронезависимо), не комментарием.
- CHECK `users_email_normalized_chk`: `email = lower(email) AND email = btrim(email)
  AND length(email) > 0` — отклоняет ненормализованные значения на записи.
  Проверено: `MixedCase@X.CO`, `  spaced@x.co  `, `GOOD@X.CO` → отклонены;
  `good@x.co` → принят.
- `role` — enum `UserRole` (`ADMIN`/`EDITOR`/`ARTIST`/`USER`), `NOT NULL DEFAULT
  'USER'` → обычный пользователь получает `USER`.
- `artistId` — `uuid?` (FK к `Artist` появится с моделью артиста; сейчас индекс).
- `passwordHash?`, `emailVerifiedAt?`, `displayName?`.

### Session / `sessions`
`tokenHash` UNIQUE (только хэш), `expiresAt`, `revokedAt?`, `ip? inet`,
`userAgent?`; FK `user_id` → `users` `ON DELETE CASCADE`; индексы `user_id`,
`expires_at`.

### Beat / `beats`
- `slug`, `caseNumber` UNIQUE; `status` (`available` default); `genre` — enum
  `BeatGenre` (`boombap`/`rap`/`trap`/`drill`/`another`, default `boombap`),
  совпадает с `BEAT_GENRES` из `src/lib/beats-taxonomy.ts`.
- Добавлены: `coverPalette` (default), `previewFileName?`, `previewMimeType?`,
  `previewSizeBytes? int`, `availableForDownload bool default false`,
  `substyle?`, `mood?`, `bpm?`, `durationSeconds?`, `publishedAt?`.
- Ключи объектного хранилища: `coverKey?`, `previewKey?`, `masterKey?`,
  `archiveKey?` — **только ключи, URL не хранятся** (тем более для приватных).
- Индексы `status`, `featured`.

### UploadIntent / `upload_intents`
| Поле | |
|---|---|
| `ownerId` | `uuid` NOT NULL, FK → `users` `CASCADE` |
| `entityType` | enum (`beat`/`track`/`artist`/`post`), NOT NULL |
| `entityId` | `uuid` **NOT NULL** |
| `kind` | `UploadKind` (совпадает со строками из `src/lib/storage/keys.ts`) |
| `visibility` | `public`/`private` |
| `key` | TEXT **UNIQUE** |
| `contentType` | TEXT **NOT NULL** |
| `expectedSize` | `bigint` **NOT NULL** |
| `actualSize` | `bigint?` (заполняется на finalize) |
| `state` | enum `PENDING`/`FINALIZED`/`ATTACHED`/`DELETING`/`EXPIRED`, default `PENDING` |
| `expiresAt` | `timestamptz` NOT NULL |
| `finalizedAt` | `timestamptz?` |
| `attachedAt` | `timestamptz?` |

Индексы: `(state, expires_at)` и `(owner_id)`.

Смысл (schema-only, к Prisma ещё **не подключено** — M7.2):
`upload-url` → `PENDING`; `finalize` принимает только существующий `PENDING`,
после `HeadObject` пишет `actualSize` + `finalizedAt` → `FINALIZED`; привязка к
`Beat` → `attachedAt` → `ATTACHED`.

---

## 6. Backend-переключатели

`.env.example`:

```
DATA_BACKEND=postgres          # цель и дефолт
STORAGE_BACKEND=contabo-s3      # цель и дефолт; пусто ⇒ contabo-s3
```

Формулировки «Supabase — текущий/default backend» убраны. Пакеты `@supabase/*`
и старые runtime-файлы **не удалены** — удаляются по мере замены маршрутов.

`getStorageBackend()` ([src/lib/storage/config.ts](../src/lib/storage/config.ts)):

- пусто или `contabo-s3` → `"contabo-s3"`;
- `supabase` → `"supabase"` (легаси, пока маршруты мигрируют; не fallback);
- любое другое значение → `StorageConfigError` (fail closed).

---

## 7. Скрипты (package.json)

| Скрипт | Действие |
|---|---|
| `build` | `prisma generate && next build` |
| `postinstall` | `prisma generate` |
| `db:migrate:deploy` | `prisma migrate deploy` |
| `db:studio` | `prisma studio` |
| `test` | `tsx --test "src/lib/**/*.test.ts"` |

---

## 8. Результаты проверок M1.2a

| Проверка | Результат |
|---|---|
| `prisma validate` | ✓ valid |
| `prisma migrate deploy` на **чистой** БД (down → очистка pgdata → up → deploy) | ✓ одна миграция `20260906190659_init`; 4 таблицы + 7 enum + `citext` + CHECK |
| `prisma migrate status` | ✓ «up to date» |
| Дрейф схемы (`migrate diff`) | ✓ «No difference detected» |
| `prisma generate` | ✓ |
| Prisma client round-trip как `hamloprod_app` | ✓ User (default role `USER`), Beat (defaults, enum `genre`), UploadIntent `PENDING→FINALIZED` + `BigInt` |
| `hamloprod_migrator` не superuser | ✓ `rolsuper=f`, `NOCREATEDB`, `NOCREATEROLE` |
| migrator выполняет миграцию | ✓ (владелец БД/схемы; `CREATE EXTENSION citext` — trusted, разрешён) |
| `hamloprod_app` DML | ✓ INSERT/UPDATE/DELETE/SELECT |
| `hamloprod_app` DDL | ✓ запрещён (CREATE/ALTER/DROP) |
| email нормализация | ✓ CHECK отклоняет mixed-case / untrimmed / empty; `citext` UNIQUE |
| bind mount = `/home/deploy/app-data/hamloprod/pgdata` | ✓ (`docker inspect`) |
| memory limit | ✓ 768 MiB (`HostConfig.Memory=805306368`), `shm_size` 256 MiB |
| порт | ✓ `127.0.0.1:55434` only |
| migration с нуля | ✓ (см. выше) |
| `npm test` | ✓ 57 / 57 |
| `npm run lint` | ✓ 0 errors, 13 warnings (существующие файлы) |
| `npm run build` | ✓ Compiled successfully |
| Supabase в новом коде | нет |
| Реальные данные перед пересозданием | нет — только тестовые вставки, удалены |

---

## 9. Как поднять на другой машине

```bash
mkdir -p /home/deploy/app-data/hamloprod/pgdata
cp .env.example .env   # POSTGRES_ADMIN_PASSWORD, MIGRATOR_DB_PASSWORD, APP_DB_PASSWORD, *_URL
docker compose up -d
npm ci                 # postinstall -> prisma generate
npm run db:migrate:deploy
```

---

## 10. Открытые вопросы (вне M1.2a)

| # | Пункт |
|---|---|
| R1 | Подключение Vercel → VPS — **подготовлено в M1.3** (`docs/preview-db-connection.md`, `deploy/preview-db/`): PgBouncer + `sslmode=verify-full` + SCRAM + лимит соединений. Проверено локально (loopback, 8/8). Активация — действия владельца (DNS, LE-сертификат, публикация порта, Vercel Preview) |
| R2 | PgBouncer — **добавлен в M1.3** как overlay `deploy/preview-db/docker-compose.pgbouncer.yml` (transaction pooling, `default_pool_size=8`); базовый `docker-compose.yml` не изменён |
| R3 | Нет автоматического бэкапа новой БД — `pg_dump` daily по образцу VPS (`docs/infrastructure-audit.md` §10) |
| R4 | Апгрейд Prisma до 7/8 (нужен `prisma.config.ts` + driver adapter) — отдельная задача |
| R5 | Репозитории / сервисы поверх Prisma и переключатель `DATA_BACKEND` в коде — M2 |
| R6 | Storage API (`upload-url`/`finalize`) к Prisma не подключён — M7.2 |
| R7 | `Artist` FK для `User.artistId` — с моделью артиста (позже) |

---

## 11. Следующий шаг

Авторизация (**M6.1** — собственный admin login) не начинается до приёмки M1.2a.
ТЗ M6.1 — в отчёте по этому коммиту.

**M1.3 (2026-09-08):** безопасное подключение Vercel Preview → VPS PostgreSQL
подготовлено — `docs/preview-db-connection.md`. Осталось активировать (владелец):
DNS `db.hamloprod.org` → VPS, LE-сертификат, публикация порта 6432 + firewall,
Vercel Preview. Затем закрывается Preview-гейт M7.2b.
