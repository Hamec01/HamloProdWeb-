# Vercel Preview → VPS PostgreSQL — secure connection (M1.3)

Статус: **подготовлено, не активировано.** Ветка `migration/self-hosted-backend`.
Основание: `docs/infrastructure-audit.md` §9, §11 (R1/R2), `docs/postgres-foundation.md`
§10 (R1/R2), `roadmap_v2.md` §16 M1. Закрывает Preview-гейт M7.2b
(`docs/storage-migration.md`).

Цель — дать Vercel Preview доступ к самостоятельно размещённой PostgreSQL на VPS
так, чтобы:

- порт **5432 не открывался в интернет** (Docker обходит UFW — см. аудит §6/R1);
- транспорт — **TLS с проверкой сертификата** на стороне клиента (`sslmode=verify-full`);
- ходит только роль приложения `hamloprod_app` (DML), с **лимитом соединений**;
- миграции (`hamloprod_migrator`, DDL) идут **отдельным приватным каналом**,
  никогда через публичный endpoint;
- serverless-пул коротких соединений мультиплексируется через **PgBouncer**
  (transaction pooling);
- production (`STORAGE_BACKEND`/`DATA_BACKEND` на проде, Supabase) **не трогается**.

Всё, что можно подготовить в репозитории, подготовлено и проверено локально
(loopback, self-signed CA) — раздел 6. Активация требует действий владельца
(DNS, сертификат, публикация порта, firewall) — раздел 5.

---

## 1. Схема

```
Vercel Preview Function
  │ DATABASE_URL = postgresql://hamloprod_app:***@db.hamloprod.org:6432/hamloprod
  │                ?sslmode=verify-full&pgbouncer=true&connection_limit=3
  │                &pool_timeout=15&connect_timeout=10
  │  (sslmode=verify-full → проверка цепочки по системному trust store Node;
  │   Let's Encrypt там есть, пиннинг CA-файла не обязателен для первой версии)
  ▼  публичный, TLS-only, порт 6432
db.hamloprod.org : 6432   ── явные A 84.247.130.242 / AAAA 2a02:c207:2340:7580::1
  │                            (перекрывают wildcard *.hamloprod.org → Vercel)
  ▼
PgBouncer  (контейнер hamloprod-pgbouncer, сеть hamloprod_default)
  │  client_tls_sslmode = require   — предъявляет LE-сертификат db.hamloprod.org
  │  auth_type = scram-sha-256, userlist.txt = ТОЛЬКО hamloprod_app
  │  pool_mode = transaction, default_pool_size = 8, max_client_conn = 100
  │  server_tls_sslmode = prefer    → require после Postgres ssl=on (Phase 2)
  ▼  приватная docker-сеть, наружу НЕ публикуется
PostgreSQL 16  (hamloprod-postgres)  :5432
  │  по-прежнему bind только 127.0.0.1:55434 для локальных операций
  │  hamloprod_app  CONNECTION LIMIT 20   (DML, без DDL)
  ▲
  └ DIRECT_URL (миграции) = postgresql://hamloprod_migrator:***@127.0.0.1:55434/hamloprod
    `npm run db:migrate:deploy` запускается НА VPS (репозиторий уже там).
    Публичного доступа для миграций нет; при необходимости с рабочей машины —
    SSH-туннель на 127.0.0.1:55434. Vercel миграции не запускает
    (`build` = `prisma generate && next build`).
```

Почему так, а не иначе (подробно — `docs/infrastructure-audit.md` §9):

- **IP-allowlist невозможен** — Vercel Hobby/Pro без статических egress IP.
  Защита на уровне транспорта + аутентификации + пула + fail2ban; allowlist в
  `DOCKER-USER` добавляется позже, когда появится Secure Compute / прокси со
  статическим IP.
- **Туннель (Cloudflare/Tailscale) для самих функций не годится** — serverless не
  держит демон. Tailscale/SSH — только операторский доступ и `DIRECT_URL`.
- **Публиковать 5432 напрямую нельзя** — обход UFW + прямой перебор.

---

## 2. Артефакты в репозитории

| Файл | Назначение |
|---|---|
| [deploy/preview-db/docker-compose.pgbouncer.yml](../deploy/preview-db/docker-compose.pgbouncer.yml) | overlay на базовый compose; сервис `pgbouncer`. `PGBOUNCER_BIND` (по умолчанию `127.0.0.1`) — единственный переключатель «loopback → публично» |
| [deploy/preview-db/pgbouncer.ini](../deploy/preview-db/pgbouncer.ini) | transaction pooling, client TLS, SCRAM, бюджет соединений, таймауты |
| [deploy/preview-db/userlist.txt.example](../deploy/preview-db/userlist.txt.example) | шаблон auth_file; реальный `userlist.txt` (SCRAM-verifier `hamloprod_app`) gitignored |
| [deploy/preview-db/01-connection-limits.sql](../deploy/preview-db/01-connection-limits.sql) | `ALTER ROLE … CONNECTION LIMIT` для работающей БД |
| [prisma/docker/initdb/00-roles.sh](../prisma/docker/initdb/00-roles.sh) | те же лимиты для БД «с нуля» |
| [deploy/preview-db/issue-cert.md](../deploy/preview-db/issue-cert.md) | LE-сертификат `db.hamloprod.org`: DNS-01 через Vercel API (осн.) / HTTP-01 через Caddy (fallback) + автопродление |
| [deploy/preview-db/network-exposure.md](../deploy/preview-db/network-exposure.md) | публикация порта 6432: `DOCKER-USER` rate-limit + fail2ban + проверка/откат |
| [deploy/preview-db/postgres-tls.md](../deploy/preview-db/postgres-tls.md) | Phase 2: `ssl=on` + `hostssl`-only `pg_hba` (до production) |
| [deploy/preview-db/gen-selfsigned-cert.sh](../deploy/preview-db/gen-selfsigned-cert.sh) | self-signed cert только для loopback-проверки |
| [scripts/db-connection-check.mts](../scripts/db-connection-check.mts) | сквозная проверка endpoint: TLS/сертификат, роль, лимит, запрет DDL |

---

## 3. Бюджет соединений

| Параметр | Значение | Почему |
|---|---|---|
| Postgres `max_connections` | 40 (без изменений) | RAM VPS ограничена (аудит §2) |
| PgBouncer `default_pool_size` | 8 | серверных соединений к Postgres на (user,db) |
| PgBouncer `reserve_pool_size` | 4 | всплески |
| PgBouncer `max_client_conn` | 100 | клиентских (Vercel) соединений |
| URL `connection_limit` | 3 | верхняя граница пула Prisma на 1 инстанс функции |
| `hamloprod_app` `CONNECTION LIMIT` | 20 | жёсткий предел на роль в самой БД |
| `hamloprod_migrator` `CONNECTION LIMIT` | 4 | миграции держат ≤1 |

PgBouncer никогда не откроет к Postgres больше `8 + 4 = 12` → остаётся ≥28 на
локальные операции, миграции, `psql`. Для production пересчитать под реальную
конкуренцию Vercel (M10).

---

## 4. Preview environment (Vercel → Settings → Environment Variables, **Preview** scope)

Production/Development scope не трогать.

```env
DATA_BACKEND=postgres
STORAGE_BACKEND=contabo-s3

DATABASE_URL=postgresql://hamloprod_app:<APP_DB_PASSWORD>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true&connection_limit=3&pool_timeout=15&connect_timeout=10
# DIRECT_URL не используется рантаймом; ставим = DATABASE_URL, чтобы prisma CLI не ругался на этапе generate
DIRECT_URL=postgresql://hamloprod_app:<APP_DB_PASSWORD>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true&connection_limit=3

SESSION_SECRET=<новый, 48 байт base64url, ОТДЕЛЬНЫЙ от прод>

S3_ENDPOINT=https://usc1.contabostorage.com
S3_REGION=usc1
S3_ACCESS_KEY=<технический ключ>
S3_SECRET_KEY=<технический секрет>
S3_BUCKET_PUBLIC=hamloprod-public
S3_BUCKET_PRIVATE=hamloprod-private
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=            # пусто, если Contabo не отдаёт путь с префиксом проекта

AUTH_EXTRA_ORIGINS=https://<точный-origin-preview-деплоя>
```

### `AUTH_EXTRA_ORIGINS` — точный origin

Использовать **стабильный git-branch alias**, а не per-deploy hash:
`https://<project>-git-migration-self-hosted-backend-<team-scope>.vercel.app`
(точное значение — на странице деплоя, поле *Domains*). Без wildcard, со схемой
`https://`, без завершающего `/`.

Этот origin нужен в двух местах, и `AUTH_EXTRA_ORIGINS` — единственный источник:

1. **Приложение** — `src/lib/auth/origin.ts` добавляет его в allow-list mutation-
   запросов (иначе `POST /api/admin/*` → 403).
2. **CORS обоих бакетов** — `corsOriginsFromEnv()` (M7.2a-follow-up) складывает
   фиксированные origins + `AUTH_EXTRA_ORIGINS`. Владелец получает готовый JSON:

   ```
   AUTH_EXTRA_ORIGINS="https://<preview-origin>" \
     npx tsx scripts/storage-provision.mts --check
   ```

   и вставляет блок «CORS (both buckets)» в панель Contabo для `hamloprod-public`
   **и** `hamloprod-private` (технический ключ применить CORS не может —
   `docs/storage-migration.md` §4.4).

### Административный S3-ключ приложению не нужен — проверено

Рантайм (`ContaboS3Storage`) использует только объектные операции: presigned
PUT/GET, `HeadObject`, `DeleteObject`, `PutObject`. `PutBucketPolicy` /
`PutBucketCors` есть только в `scripts/storage-provision.mts` (ops-инструмент) и
никогда не на пути запроса. Локальный e2e M7.2b (34/34) прошёл весь браузерный
поток с object-scoped ключом. **Preview'у достаточно технического ключа.**

---

## 5. Активация — действия владельца (по порядку)

Ничего из этого не выполнено; production не затрагивается.

### 5.1 DNS (Vercel dashboard → hamloprod.org → DNS)

`*.hamloprod.org` — wildcard на Vercel, поэтому нужен явный override:

| Type | Name | Value |
|---|---|---|
| `A` | `db` | `84.247.130.242` |
| `AAAA` | `db` | `2a02:c207:2340:7580::1` |

Проверка: `dig +short A db.hamloprod.org @ns1.vercel-dns.com` → `84.247.130.242`.

### 5.2 Сертификат `db.hamloprod.org`

`deploy/preview-db/issue-cert.md`, Option A (DNS-01 через scoped Vercel API
token, контейнер `goacme/lego`, автопродление по cron + `docker kill -s HUP`).
Токен владелец кладёт в `deploy/preview-db/acme.env` (`0600`) на VPS — **не в чат**.
Результат: `deploy/preview-db/certs/{fullchain,privkey}.pem`.

### 5.3 userlist + лимиты соединений (на VPS)

```
cd /home/deploy/projects/hamloprod-web
docker exec hamloprod-postgres psql -U postgres -tAc \
  "SELECT '\"'||rolname||'\" \"'||rolpassword||'\"' FROM pg_authid WHERE rolname='hamloprod_app'" \
  > deploy/preview-db/userlist.txt
chmod 0644 deploy/preview-db/userlist.txt
docker exec -i hamloprod-postgres psql -U postgres -d postgres < deploy/preview-db/01-connection-limits.sql
```

### 5.4 Поднять PgBouncer публично + firewall

`deploy/preview-db/network-exposure.md`:

```
PGBOUNCER_BIND=0.0.0.0 docker compose \
  -f docker-compose.yml -f deploy/preview-db/docker-compose.pgbouncer.yml up -d
```

затем в том же окне: `DOCKER-USER` rate-limit (root) + fail2ban jail (root).

### 5.5 Vercel Preview

Создать Preview-деплой ветки `migration/self-hosted-backend` (Production не
трогать), env из раздела 4, `AUTH_EXTRA_ORIGINS` = origin этого деплоя.

### 5.6 Проверка соединения

С VPS:

```
DB_CHECK_ADDR=127.0.0.1:6432 \
DB_CHECK_URL='postgresql://hamloprod_app:<pw>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true' \
  npx tsx scripts/db-connection-check.mts        # ожидать: DB CHECK 8/8
```

Снаружи (проверка периметра): `nc -vz db.hamloprod.org 5432` → **refused**;
`nc -vz db.hamloprod.org 6432` → open;
`openssl s_client -starttls postgres -connect db.hamloprod.org:6432` → LE-issuer.

### 5.7 Contabo public bucket policy + CORS

- `hamloprod-public` policy (anon `s3:GetObject`) — `docs/storage-migration.md` §4.3;
- CORS обоих бакетов с Preview-origin — раздел 4 выше;
- затем `npx tsx scripts/storage-smoke.mts` → **5/5**.

### 5.8 Браузерный сценарий на Preview (гейт M7.2b)

Реальные медиафайлы: создать private-бит → загрузить cover / preview / WAV / ZIP →
attachment → публикация → публичная обложка рендерится → **превью реально
играет** в плеере → для WAV и ZIP: anonymous GET → запрещён, signed GET → работает.
Результаты занести в `docs/storage-migration.md` и раздел 7 ниже.

---

## 6. Что проверено локально (2026-09-08, коммит на момент работы — см. git log)

Loopback, без публикации портов, self-signed CA для `db.hamloprod.org`:

| Проверка | Результат |
|---|---|
| `docker compose config` (base + overlay) | OK, сети объединяются |
| PgBouncer стартует с `pgbouncer.ini` | OK, без ошибок парсинга (`PgBouncer 1.24.1`) |
| `scripts/db-connection-check.mts` через loopback PgBouncer, `sslmode=verify-full` + `sslrootcert=ca.pem` | **8/8**: TCP; STARTTLS предложен; SAN покрывает `db.hamloprod.org`; сертификат не истёк; verify-full прошёл (Prisma подключился с пиннингом); `current_user=hamloprod_app`; `CONNECTION LIMIT=20`; `CREATE TABLE` → `permission denied for schema public` |
| Негативный тест: `hamloprod_migrator` через пулер | **`SASL authentication failed`** — роль не в userlist, отклонена |
| backend-hop TLS (PgBouncer→Postgres) | `ssl=false` — ожидаемо (`server_tls_sslmode=prefer`, у Postgres нет `ssl=on`; Phase 2) |
| `hamloprod_app` / `hamloprod_migrator` CONNECTION LIMIT на dev-БД | 20 / 4 (применено, совпадает с `00-roles.sh`) |
| `npm test` / `npm run lint` / `npm run build` | см. раздел 7 |

Локальный PgBouncer после проверки удалён (`docker compose … rm -sf pgbouncer`);
`hamloprod-postgres` не трогался.

---

## 7. Блокеры и следующий шаг

**Заблокировано доступом владельца (без него Preview-гейт M7.2b не закрыть):**

1. **DNS** `db.hamloprod.org` → VPS (перекрыть wildcard) — Vercel dashboard.
2. **LE-сертификат** `db.hamloprod.org` — нужен scoped Vercel API token (DNS-01)
   либо правка host Caddy (HTTP-01). `issue-cert.md`.
3. **Публикация порта 6432 + firewall** — `PGBOUNCER_BIND=0.0.0.0` + правило
   `DOCKER-USER` + fail2ban jail (последние два требуют root). `network-exposure.md`.
4. **Vercel Preview-деплой** ветки + Preview env (раздел 4). CLI/токена Vercel в
   рабочем окружении нет.
5. **Contabo**: policy `hamloprod-public` + CORS обоих бакетов (object-scoped ключ
   не применяет — `docs/storage-migration.md` §4.3–4.4).

**После 1–5:** `scripts/db-connection-check.mts` → 8/8; `scripts/storage-smoke.mts`
→ 5/5; браузерный сценарий 5.8; занести результаты сюда и в
`docs/storage-migration.md`.

**Phase 2 (до production, не для Preview):** Postgres `ssl=on` + `hostssl`-only
`pg_hba` (`postgres-tls.md`); `DIRECT_URL` через SSH-туннель/Tailscale;
пересчёт бюджета соединений под конкуренцию Vercel; ежедневный `pg_dump`
(аудит §10). **M7.2b не считается завершённым, пока браузерный гейт 5.8 не пройден.**

### Live activation update (2026-09-10)

DNS, Let's Encrypt, PgBouncer, внешний `6432`, `DOCKER-USER` rate limit,
fail2ban jail и Vercel Preview активированы. Внешний TCP test прошёл, TLS
`verify_hostname db.hamloprod.org` вернул `Verify return code: 0`, порт 5432
остаётся закрыт. Preview подключается через PgBouncer и отдаёт PostgreSQL-каталог.

Файл `restore-firewall-block.sh` теперь восстанавливает rate limit после
перезапуска Docker и удаляет прежний временный deny-all. После обновления checkout
его нужно повторно установить в `/usr/local/sbin/hamloprod-db-firewall` и
перезапустить `hamloprod-db-firewall.service`.
