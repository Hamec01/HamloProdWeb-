# PostgreSQL foundation — M1.2

Статус: выполнено. Ветка `migration/self-hosted-backend`.
Основание: `roadmap_v2.md` (§16 M1), `docs/infrastructure-audit.md` (§12),
`docs/migration-from-supabase.md` («Точный следующий этап M1»).

Решение (окончательное, от пользователя):

- Supabase недоступен; **данные и файлы из Supabase не переносятся**;
- создаётся **чистая** PostgreSQL; контент будет загружен заново;
- **новые функции не используют Supabase** — только этот слой.

M1.2 создаёт фундамент: контейнер PostgreSQL 16 на 127.0.0.1, Prisma schema
(`User`, `Session`, `Beat`, `UploadIntent`), одну начальную миграцию и DB client.
Существующий Supabase-код и runtime не тронуты. Prod Vercel env, firewall, Caddy
и чужие контейнеры не тронуты.

---

## 1. Что добавлено

| Файл | Назначение |
|---|---|
| [docker-compose.yml](../docker-compose.yml) | PostgreSQL 16, публикация **только** `127.0.0.1:${POSTGRES_HOST_PORT:-55434}:5432`, compose-project `hamloprod`, healthcheck, `restart: unless-stopped` |
| [prisma/docker/initdb/10-app-role.sh](../prisma/docker/initdb/10-app-role.sh) | one-time init: создаёт least-privilege роль `hamloprod_app` (только DML), `ALTER DEFAULT PRIVILEGES`, `REVOKE CREATE ON SCHEMA public` |
| [prisma/schema.prisma](../prisma/schema.prisma) | datasource (`url`=`DATABASE_URL`, `directUrl`=`DIRECT_URL`), 6 enum, 4 модели |
| [prisma/migrations/20260906182235_init/migration.sql](../prisma/migrations/20260906182235_init/migration.sql) | начальная миграция (enums, tables, indexes, FK) |
| [prisma/migrations/migration_lock.toml](../prisma/migrations/migration_lock.toml) | `provider = "postgresql"` |
| [src/lib/db/client.ts](../src/lib/db/client.ts) | singleton `PrismaClient` (переиспользуется между hot-reload и serverless-инвокациями) |
| [src/lib/db/config.ts](../src/lib/db/config.ts) | server-only проверка `DATABASE_URL` (postgres-only, без вывода значений), `describeDatabaseConfig` |
| [src/lib/db/config.test.ts](../src/lib/db/config.test.ts) | 5 тестов |
| [.env.example](../.env.example) | новый блок «Self-hosted PostgreSQL» — только пустые значения и комментарии |
| [package.json](../package.json) | deps + скрипты (см. §5) |

Зависимости (закреплённые точные версии):

| Пакет | Версия | Тип | Примечание |
|---|---|---|---|
| `prisma` | `6.19.3` | dev | стабильная 6.x. `prisma@latest` в npm сейчас указывает на `8.0.0-rc` (pre-release) — намеренно не берём |
| `@prisma/client` | `6.19.3` | dependency | пара к CLI |

Prisma 7 отклонён для фундамента: 7.x убрал `url`/`directUrl` из `schema.prisma`
(требует `prisma.config.ts` + driver adapter `@prisma/adapter-pg` + `pg`), это
больше зависимостей и новизны; для M1.2 нужен предсказуемый минимум. Апгрейд —
отдельной задачей позже.

---

## 2. Модель данных

Native Postgres enums; snake_case таблицы/колонки через `@@map`/`@map`;
время — `timestamptz(6)` UTC; PK — `uuid` через `gen_random_uuid()` (DB-side);
`created_at`/`updated_at` имеют DB-default `now()`, `updated_at` дополнительно
ведётся Prisma (`@updatedAt`).

| Модель / таблица | Ключевые поля | Индексы / связи |
|---|---|---|
| `User` / `users` | `email` UNIQUE (хранить нормализованным), `password_hash?` (NULL = не может логиниться паролем), `role?` (`admin`/`editor`/`artist`), `display_name?` | → `sessions`, `upload_intents` |
| `Session` / `sessions` | `token_hash` UNIQUE (хранится только хэш), `expires_at`, `revoked_at?`, `ip? inet`, `user_agent?` | FK `user_id` → `users` `ON DELETE CASCADE`; индексы `user_id`, `expires_at` |
| `Beat` / `beats` | `slug` UNIQUE, `case_number` UNIQUE, `status` (`available`/`reserved`/`sold`/`private`, default `available`), `price_usd`/`price_rub` int, `bpm?`, `*_key?` (ключи объектного хранилища, не URL), `featured`, `published_at?` | индексы `status`, `featured` |
| `UploadIntent` / `upload_intents` | `kind` (совпадает со строками `UploadKind` из `src/lib/storage/keys.ts`), `visibility`, `key` UNIQUE, `state` (`pending`/`attached`/`deleting`/`expired`), `expires_at`, `size_bytes bigint?` | FK `owner_id`→`users` `SET NULL`, `beat_id`→`beats` `CASCADE`; индексы `(state, expires_at)` для cleanup, `(entity_type, entity_id)` |

`UploadIntent` связывает объектное хранилище (M7) с БД: сервер создаёт `pending`
intent до выдачи presigned PUT, переводит в `attached` при `finalize`, а
просроченные `pending`/`deleting` подметает фоновая задача (M7.2+).

`Beat` намеренно минимальна (без reservation/sale/loyalty/rights) — это фундамент;
недостающие поля и модели (`Track`, `Artist`, `Order`, `Contract`, …) добавляются
на M2–M5 по `docs/migration-from-supabase.md`.

---

## 3. Роли и доступ (least privilege)

| Роль | Кем используется | Права |
|---|---|---|
| `hamloprod_migrator` (`POSTGRES_USER`, владелец схемы) | `DIRECT_URL` — только `prisma migrate` | DDL, владелец таблиц, создаёт shadow DB для `migrate dev` |
| `hamloprod_app` | `DATABASE_URL` — runtime (`src/lib/db/client.ts`) | `CONNECT`, `USAGE ON SCHEMA public`, `SELECT/INSERT/UPDATE/DELETE` на таблицах (через `ALTER DEFAULT PRIVILEGES`). **`CREATE` на схеме отозван** — DDL невозможен |

`DIRECT_URL` никогда не читается кодом приложения (только Prisma CLI).
Пароли — в gitignored `.env` (локально) и в Vercel env / `.env.local` (позже).
В Git и в отчёт не попадают. `NEXT_PUBLIC_` для строк подключения не создаются.

---

## 4. Сеть

```
docker-compose.yml → ports: "127.0.0.1:55434:5432"
```

Проверено: `ss -tlnH` показывает `LISTEN 127.0.0.1:55434` и **не** `0.0.0.0` /
`[::]`. База недоступна из сети. Подключение Vercel → VPS (TLS-прокси / туннель +
выделенный публичный endpoint, `DATABASE_URL` c `sslmode=verify-full`) — отдельный
шаг, вне M1.2 (см. `docs/infrastructure-audit.md` §9).

Compose-project назван `hamloprod`, том — `hamloprod_pgdata` (named volume;
для хранения под `/home/deploy/app-data/hamloprod/pgdata` задать `HAMLOPROD_PGDATA`
в `.env` до первого `up`). Чужие 15 контейнеров не тронуты; добавлен один —
`hamloprod-postgres`.

---

## 5. Скрипты (package.json)

| Скрипт | Действие |
|---|---|
| `build` | `prisma generate && next build` (Vercel-рекомендованный порядок; `generate` не требует БД) |
| `postinstall` | `prisma generate` (чтобы `@prisma/client` был сгенерирован после `npm ci`) |
| `db:migrate:deploy` | `prisma migrate deploy` — применить миграции на целевой БД |
| `db:studio` | `prisma studio` |
| `test` | `tsx --test "src/lib/**/*.test.ts"` (расширено с `storage/` на весь `lib/`) |

---

## 6. Результаты проверок M1.2

| Проверка | Результат |
|---|---|
| `prisma validate` | ✓ schema valid |
| `prisma migrate dev --name init` | ✓ одна миграция `20260906182235_init`, применена |
| `prisma migrate deploy` на **свежей** БД (down -v → up → deploy) | ✓ применяется чисто; 4 таблицы + 6 enum + `_prisma_migrations` |
| `prisma migrate status` | ✓ «Database schema is up to date!» |
| Дрейф схемы (`migrate diff` live DB ↔ schema) | ✓ «No difference detected» |
| `prisma generate` (в т.ч. без env) | ✓ client сгенерирован |
| Prisma client round-trip как `hamloprod_app` | ✓ create/read/relations User+Beat+UploadIntent, `gen_random_uuid()` PK, авто-`updatedAt`, `BigInt`, enum `@map` |
| `hamloprod_app`: DML | ✓ INSERT/SELECT/UPDATE/DELETE |
| `hamloprod_app`: DDL | ✓ запрещён (`permission denied for schema public`, `must be owner`) |
| `hamloprod_migrator`: DDL | ✓ разрешён |
| Порт 55434 | ✓ `127.0.0.1` only, не `0.0.0.0` |
| Чужие контейнеры | ✓ 15/15 `Up`, не тронуты; добавлен 1 |
| `npm run lint` | ✓ 0 errors, 13 warnings (все — в существующих файлах) |
| `npm run build` | ✓ Compiled successfully |
| `npm test` | ✓ 57 / 57 pass (52 storage + 5 db) |
| Supabase в новом коде | нет — `prisma/*`, `docker-compose.yml`, `src/lib/db/*` не импортируют Supabase |
| `LICENSEMAKER/`, `roadmap_v2.md`, firewall, Caddy, prod Vercel env | не тронуты |

---

## 7. Как поднять на другой машине

```bash
cp .env.example .env
# заполнить POSTGRES_PASSWORD, APP_DB_PASSWORD, DATABASE_URL, DIRECT_URL
docker compose up -d
npm ci                 # postinstall → prisma generate
npm run db:migrate:deploy
```

`DATABASE_URL` использует `hamloprod_app`, `DIRECT_URL` — `hamloprod_migrator`
(см. `.env.example`).

---

## 8. Риски и открытые вопросы

| # | Пункт | Статус |
|---|---|---|
| R1 | `email` — обычный `TEXT UNIQUE`, регистронезависимость на уровне приложения (нормализация перед записью) | осознанно; `citext`/функциональный индекс — при желании на M6 |
| R2 | Подключение Vercel → VPS не настроено (по замыслу M1.2) | отдельный шаг: TLS-прокси/туннель + публичный endpoint + `sslmode=verify-full` |
| R3 | Нет PgBouncer | добавить при подключении Vercel (serverless → много коротких соединений) |
| R4 | Нет автоматического бэкапа для новой БД | M1.x: `pg_dump` daily по образцу VPS (systemd timer + off-box копия), см. `docs/infrastructure-audit.md` §10 |
| R5 | `prisma@latest` в npm = `8.0.0-rc` (pre-release); закреплено `6.19.3` | апгрейд до 7/8 — отдельной задачей (нужен `prisma.config.ts` + driver adapter) |
| R6 | `Beat` минимальна; репозитории/сервисы ещё не подключены | M2+ по `docs/migration-from-supabase.md` |
| R7 | `DATA_BACKEND` переключатель ещё не введён | когда появятся репозитории (M2); сейчас новый слой просто не импортируется существующим runtime |
| R8 | Локальный `.env` с dev-паролями создан на этой машине (gitignored) | не коммитить; для prod — свои значения в Vercel env |

---

## 9. Следующий шаг

M2 (или M1.3, если сначала бэкап/подключение): репозитории поверх Prisma
(`BeatRepository` → `PrismaBeatRepository`), `DATA_BACKEND` переключатель
(default — по решению; Supabase недоступен), затем перенос admin CRUD битов на
PostgreSQL и загрузка каталога заново.
