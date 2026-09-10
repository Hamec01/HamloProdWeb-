# HamloProd M10 — production cutover

Дата начала: 2026-09-10. Ветка `release/production-cutover` (worktree, от
`origin/migration/self-hosted-backend` @ `b2d78aa`). ТЗ:
`docs/claude-handoff-production-cutover.md`.

## ИТОГ: **STOPPED — production НЕ переключён**

`hamloprod.org` продолжает работать на прежнем Supabase-runtime. Ни один
production alias / env / DNS не тронут. Откат не требовался (переключения не
было).

4 STOP-gate не могут быть закрыты из автоматической сессии и требуют владельца
(раздел «Оставшиеся действия владельца»). Всё, что можно было подготовить и
проверить независимо — сделано и зафиксировано.

---

## Что выполнено и проверено

### 1. Worktree + git-gate — OK

`git worktree` `release/production-cutover` от `origin/migration/self-hosted-backend`
(`b2d78aa`). `origin/main` — предок migration-ветки (проверено), migration впереди
на 23 коммита. Текущий checkout не тронут (untracked `.vscode/` / `LICENSEMAKER/`
/ `roadmap_v2.md` на месте). env/creds/`.vercel` скопированы в worktree
(gitignored, не коммитятся).

### 2. Повторная проверка кода — OK

`npm ci` · `npm test` **184/184** (0 skipped — db-тесты выполнены) · `npm run lint`
0 errors (9 warnings в ранее существовавших файлах) · `npm run build` exit 0 ·
`git grep` Supabase в `src/` — только assert-регулярки в `*no-supabase*.test.ts`,
0 runtime-импортов · `git diff --check` OK · секретов в tracked-файлах нет.

### 3. Preview E2E — **substitute 51/51 + владелец визуально проверил Preview → принято**

Preview `dpl_Bu8KsTz7oGFasAzrBAQfxCyskecx` (commit `b2d78aa`) — **READY** на
проекте `hamlo-prod-web`. Под Vercel SSO; создание Protection-Bypass secret и
Vercel MCP в сессии недоступны → автоматический браузерный прогон 12 пунктов из
сессии не выполнялся.

**Решение владельца (msg 2026-09-10):** не блокировать cutover из-за
невозможности автоматического обхода Preview SSO. Основание принято:
(а) сквозной HTTP E2E 51/51 против прод-сборки + реальный PostgreSQL + реальный
Contabo (ниже); (б) владелец лично открыл Preview в браузере и визуально
подтвердил каталог, страницу бита, вход и проигрывание. Это зафиксировано как
принятое владельцем подтверждение STOP-gate 3. Остаётся обязательным только
пост-cutover просмотр **Vercel Runtime Logs** (Preview и Production) на предмет
Prisma init errors / connection timeouts / 5xx.

Substitute: сквозной HTTP E2E против `next start` прод-сборки worktree + реальный
PostgreSQL (`hamloprod-postgres` через тот же `db.hamloprod.org:6432` PgBouncer) +
реальный Contabo → **51/51 PASS**:

| Пункт ТЗ §3 | HTTP-проверка |
|---|---|
| 1 | `/`, `/en`, `/ru`, `/en/beats`, `/en/ham`, `/en/vst` → 200; в HTML нет секретов/private-ключей/DB-URL |
| 2 | beat preview MP3: full 200 + Range **206** + `Content-Range`; track stream signed URL Range **206** |
| 3 | buyer signup → 201 + cookie (`HttpOnly`, `SameSite=Lax`) → `/api/auth/me` authenticated → logout → re-login 200 |
| 4 | legacy bcrypt login → 200; `password_hash` в БД стал `$argon2id$…` (только префикс) |
| 5 | admin create/edit/delete track → 200; mutation без `Origin` → **403** |
| 6 | admin create private beat → 201 |
| 7 | upload-url → PUT → finalize → attach для cover/preview/WAV/ZIP (все 200); 4 intents `ATTACHED`; 4 ключа на бите |
| 8 | publish (status→available) → 200; публичная страница бита → 200; публичная обложка отрендерена; private WAV/ZIP ключей в HTML нет |
| 9 | WAV и ZIP anonymous GET → **401**; signed GET → 200, длина байт совпадает |
| 10 | reaction/rating/comment/purchase → 200; loyalty points; profile → 200 |
| 11 | conditional PUT replay → **412** (все 4 ассета) |
| 12 | `/api/auth/me` и HTML публичных страниц — без `$argon2`/`$2a$`/`password_hash`/`SESSION_SECRET`/`postgresql://` |

Тестовые данные (email `cutover-e2e-*`, beat/track slug `cutover-e2e-*`) удалены;
БД и Contabo вернулись к baseline (users 4, beats 41, tracks 198, orders 3,
purchases 9; Contabo public 146 / private 259 объектов, 0 изменённых за 2 ч).

Не покрыто HTTP-прогоном: визуальный рендер и фактическое проигрывание тега
`<audio>` в браузере (Range 206 — прокси для него). Пункты 9–10 прод-smoke
(раздел ниже) добьют это на реальном домене.

### 4. Финальная дельта Supabase — **STOP (за владельцем)**

Supabase-credentials на VPS / в `.env` нет. Vercel Production env их содержит
(`POSTGRES_URL_NON_POOLING`, `SUPABASE_SERVICE_ROLE_KEY` — расшифровываются
через API), но запись расшифрованных прод-секретов в файл для read-only
сравнения заблокирована защитой сессии. Snapshot legacy-БД датирован 2026-09-09;
доказать отсутствие записей на старом Supabase после этой даты **не удалось**.
Per ТЗ §4 — это STOP до подтверждения владельца.

### 5. PostgreSQL backup + restore-test — OK

`ops/hamloprod/` (commit `974d6cb`, паттерн Titanor Time R01):

- `backup-hamloprod.sh` — `pg_dump -Fc` + `pg_restore --list` валидация + manifest
  (структура, row-counts, `migration-history.sha256`, order-independent
  `data.sha256`) + `SHA256SUMS` + atomic publish + off-box mirror с re-verify +
  ротация 7/4/3 (+30 дней для event-бэкапов) + `flock`. Без local uploads
  (Contabo). Не печатает row-content / секреты / PII.
- `restore-test-hamloprod.sh` — verify `SHA256SUMS`, restore в **disposable**
  `postgres:16` под throwaway-owner ролью, сверка migrations / структуры /
  per-table row-counts / all-data fingerprint с записанными значениями, удаление
  всех disposable-ресурсов по имени.
- systemd `hamloprod-backup@.{service,timer}` (04:40 UTC, `Persistent`) +
  `hamloprod-backup-failed@.service` (marker-файл + journal) + env-example
  (`0600`, только имена/пути).

Первый `manual` бэкап: `production-20260910T194248Z-manual` — dump 101180 B,
169 TOC, 287 rows, 9 миграций, `migration_history_sha256 99052fed…`,
`all_data_sha256 4b01ab95…`. Off-box копия `/mnt/250gb/hamloprod/backups/…` —
`SHA256SUMS` re-verify OK.

Restore-test: **13/13 PASS** — migrations 9==9, 23 таблицы, 47 routines
(citext), 0 triggers, 19 FK, 251 CHECK, 67 индексов, per-table row-counts
идентичны, all-data fingerprint совпал точно. Disposable-контейнер удалён.

**Ещё нужно:** свежий `pre-migration` бэкап + restore-test ПОСЛЕ дельты (gate 4),
`sudo systemctl enable --now hamloprod-backup@production.timer` (см.
`ops/hamloprod/README.md`).

### 6. PG/PgBouncer hardening — AUDIT OK, backend TLS STOP

| Проверка | Результат |
|---|---|
| PostgreSQL наружу | только `127.0.0.1:55434` (→ 5432 в контейнере) |
| PgBouncer | `84.247.130.242:6432`, client TLS `verify-full` против LE-cert (`db-connection-check.mts` **9/9**) |
| `userlist.txt` | только `hamloprod_app` |
| `hamloprod_migrator` через PgBouncer | `SASL authentication failed` (отклонён) |
| `hamloprod_app` DDL | `CREATE TABLE` → `permission denied for schema public` |
| connection limits | `hamloprod_app`=20, `hamloprod_migrator`=4 |
| внешний `5432` | connection refused |
| LE cert `db.hamloprod.org` | issuer Let's Encrypt YE2, действует Sep 8 – Dec 7 2026 (не близко к истечению) |
| `hamloprod-db-firewall.service` | active + enabled |
| `fail2ban` | active |
| app-роль DML на всех 23 таблицах | SELECT/INSERT/UPDATE/DELETE — все `t` |

Не проверено без sudo: содержимое цепочки `DOCKER-USER`, точный logpath jail
fail2ban после recreate контейнера (сервисы active/enabled — по handoff уже
настроены).

**Backend TLS (PgBouncer→PostgreSQL) — НЕ включён.** Сейчас `server_tls_sslmode
= prefer`, Postgres `ssl=off`, hop plaintext на изолированном docker-bridge.
Полностью готовый runbook — `deploy/preview-db/postgres-tls.md` (исправлен баг
SAN из черновика: внутренний CA + server-cert с `SAN=postgres`, скрипт
`deploy/preview-db/gen-internal-pg-cert.sh`, `deploy/preview-db/pg_hba.conf`
`hostssl`-only для bridge). Шаги `docker cp`/`docker exec` в работающий
DB-контейнер заблокированы защитой сессии → **STOP-gate**, выполняет владелец
после бэкапа.

### 7. Vercel Production env — INVENTORY OK, запись STOP

Текущий **production** target (имена + scope, без значений):

- Есть: `POSTGRES_*` + `SUPABASE_*` (старый runtime), `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_LICENSE_REQUEST_URL`,
  `NEXT_PUBLIC_SUPABASE_*`.
- **Нет для нового runtime:** `DATABASE_URL`, `DATA_BACKEND`, `STORAGE_BACKEND`,
  `SESSION_SECRET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
  `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_FORCE_PATH_STYLE`,
  `S3_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`.
- **Новый обязательный флаг:** `PAID_CHECKOUT_ENABLED=false` (kill switch платного
  checkout — см. раздел 12).
- **НЕ обязательны для cutover (решение владельца — платежи отложены):**
  `LAVA_API_BASE_URL`, `LAVA_API_KEY`, `LAVA_WEBHOOK_SECRET`, `SELLER_*`,
  `SELLER_SIGNATURE_PATH`. Пока `PAID_CHECKOUT_ENABLED` ≠ `true` они не читаются:
  `/api/checkout`, `/api/payments/create`, `/api/contracts/preview|pdf` отвечают
  контролируемым `503 {code:"PAID_CHECKOUT_DISABLED"}` до подключения провайдера
  (backlog «Подключение платёжных систем и генерации договоров», раздел 12).

Preview env уже содержит корректные `DATABASE_URL` / `SESSION_SECRET` / `S3_*` /
`DATA_BACKEND` / `STORAGE_BACKEND` — их можно скопировать в Production (кроме:
отдельный прод `SESSION_SECRET`; `AUTH_EXTRA_ORIGINS` в Production **не задавать**;
добавить `NEXT_PUBLIC_SITE_URL` и `PAID_CHECKOUT_ENABLED=false`). Запись env через
API не выполнялась (защита сессии + часть секретов недоступна).

### 8. Миграции — OK (no-op)

`prisma migrate status` (локальный `DIRECT_URL`) — «up to date», 9 миграций.
`prisma migrate deploy` — «No pending migrations». Drift — нет. Целевая БД (та же,
что использует Preview/будущий Production) уже содержит все 9 миграций и все DML
grants app-роли.

### 9–11. Deployment / smoke / rollback — НЕ выполнялись

Production не переключался (см. STOP-gates 3/4/6/7). Rollback не требовался.
Previous production deployment ID для будущего отката — зафиксировать перед
переключением (см. runbook).

---

## Оставшиеся действия владельца (по порядку)

1. **Финальная дельта Supabase (STOP-gate 4).** Либо явно подтвердить, что после
   snapshot 2026-09-09 в старый Supabase не было записей, либо предоставить
   временный read-only доступ к source и запустить сверку (count + PK + max
   `updated_at` + хэш нормализованных строк по: users/profiles, beats/releases/
   tracks/artists/posts, orders/contracts/purchases, reactions/ratings/comments/
   favorites/loyalty, storage inventory, pending/in-flight orders). Дельту, если
   есть, применить существующими idempotent-скриптами.

2. **Свежий бэкап + restore-test (STOP-gate 5, после п.1).**
   ```
   cd /home/deploy/projects/hamloprod-web
   HP_REPO_DIR=$PWD ops/hamloprod/backup-hamloprod.sh pre-migration
   ops/hamloprod/restore-test-hamloprod.sh "$(ls -d /home/deploy/backups/hamloprod/production-*-pre-migration | tail -1)"
   sudo bash -c 'install -D -m0644 ops/hamloprod/systemd/hamloprod-backup@.service /etc/systemd/system/hamloprod-backup@.service; \
     install -D -m0644 ops/hamloprod/systemd/hamloprod-backup-failed@.service /etc/systemd/system/hamloprod-backup-failed@.service; \
     install -D -m0644 ops/hamloprod/systemd/hamloprod-backup@.timer /etc/systemd/system/hamloprod-backup@.timer; \
     install -D -m0600 ops/hamloprod/systemd/backup-production.env.example /etc/hamloprod/backup-production.env; \
     systemctl daemon-reload; systemctl enable --now hamloprod-backup@production.timer'
   systemctl list-timers hamloprod-backup@production.timer
   ```

3. **Backend TLS (STOP-gate 6).** Выполнить runbook
   `deploy/preview-db/postgres-tls.md` целиком (генерация внутреннего CA →
   `docker cp` cert в контейнер → `pg_hba.conf` → `ALTER SYSTEM SET ssl=on` →
   `docker restart hamloprod-postgres` → `pgbouncer.ini` `verify-full` → recreate
   pgbouncer). Проверить: `SHOW ssl = on`, `db-connection-check.mts` «backend hop
   ssl=true», `sslmode=disable` из bridge отклонён.

4. **Production env (STOP-gate 7).** В проекте **`hamlo-prod-web`** только для
   target **Production** (Preview не трогать, старые `POSTGRES_*`/`SUPABASE_*`
   **не удалять** — нужны прежнему deployment для rollback):

   | Variable | Значение |
   |---|---|
   | `DATA_BACKEND` | `postgres` |
   | `STORAGE_BACKEND` | `contabo-s3` |
   | `DATABASE_URL` | `postgresql://hamloprod_app:<URL-ENCODED APP_DB_PASSWORD из .env>@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true&connection_limit=3&pool_timeout=15&connect_timeout=10` |
   | `SESSION_SECRET` | **новый** прод-секрет: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `S3_ENDPOINT` `S3_REGION` `S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_BUCKET_PUBLIC` `S3_BUCKET_PRIVATE` `S3_FORCE_PATH_STYLE` `S3_PUBLIC_BASE_URL` | скопировать из Preview env (там уже корректны; `S3_PUBLIC_BASE_URL` = `https://usc1.contabostorage.com/<tenant>:hamloprod-public`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://hamloprod.org` |
   | `PAID_CHECKOUT_ENABLED` | `false` (платный checkout закрыт — раздел 12) |
   | `TELEGRAM_BOT_TOKEN` `TELEGRAM_CHAT_ID` `NEXT_PUBLIC_LICENSE_REQUEST_URL` | оставить как есть |

   `LAVA_*` / `SELLER_*` **НЕ задавать** — платежи отложены, флаг закрыт. Добавить
   позже вместе с `PAID_CHECKOUT_ENABLED=true` (backlog, раздел 12).

   Правила: пароль в `DATABASE_URL` — URL-encoded; `DIRECT_URL` для Vercel **не
   задавать**; `AUTH_EXTRA_ORIGINS` в Production **не задавать** (прод-origins уже
   в фиксированном allow-list кода); `NEXT_PUBLIC_` копий секретов не создавать.

5. **Preview browser E2E (STOP-gate 3) — ПРИНЯТО владельцем.** Основание: HTTP
   E2E 51/51 + личная визуальная проверка Preview владельцем (раздел 3).
   Отдельного прогона больше не требуется. Обязателен только просмотр **Vercel
   Runtime Logs** (Preview + Production) после cutover: 0 Prisma init errors /
   connection timeouts / 5xx.

6. **Cutover (после 1–5).**
   - Зафиксировать ID текущего рабочего Production deployment (для rollback).
   - Убедиться, что все infra/docs-фиксы закоммичены и Preview этого commit
     проверен.
   - Fast-forward `origin/main` → HEAD `release/production-cutover` через PR merge
     или обычный fast-forward push (**без force-push**, без переписывания истории).
   - Дождаться Production deployment на **`hamlo-prod-web`** до `READY`; убедиться,
     что deployment commit == release HEAD и alias `hamloprod.org` указывает на
     него (Vercel меняет alias только после успешного build — старый production
     работает во время сборки).

7. **Немедленный prod smoke + 30 мин наблюдения** — `docs/claude-handoff-
   production-cutover.md` §10 **без платёжного сценария** (public RU/EN pages,
   media Range 206, buyer + legacy login, admin login/CRUD с cleanup, private
   beat upload/attach/publish, private anon-запрет + signed GET,
   profile/loyalty/social, отсутствие секретов в HTML, security headers + cookie
   флаги, Runtime Logs, PgBouncer/Postgres/CPU/RAM/disk, fail2ban+firewall
   active). **Вместо** contract preview/PDF и Lava webhook:
   `POST /api/checkout` (авторизованным buyer) → **503** с телом
   `{"code":"PAID_CHECKOUT_DISABLED"}`, **не** 500; в БД не появился новый `Order`;
   страница бита и `/checkout/<slug>` показывают «Онлайн-оплата временно
   недоступна». Тестовые prod-сущности — с узнаваемым префиксом и удалить через
   API. Rollback trigger: устойчивая 5xx / login не работает / нет каталога /
   плеер не играет / ошибка private access / DB saturation / `/api/checkout`
   отдаёт 500 вместо 503.

8. **Rollback (если trigger)** — `docs/claude-handoff-production-cutover.md` §11:
   переназначить Vercel production alias на предыдущий READY deployment; **не**
   откатывать миграции, **не** восстанавливать backup, **не** удалять новые
   Contabo-объекты; зафиксировать mutation, попавшие в PostgreSQL после cutover,
   для reconciliation.

9. **После стабильного периода (отдельное подтверждение)** — удаление legacy
   archive / Supabase project / старых Supabase Production env / предыдущего
   deployment / pre-cutover backup.

---

## 12. Временный режим отключённых платных покупок (`PAID_CHECKOUT_ENABLED`)

Решение владельца: Lava и остальные платёжные системы подключаются позже.
Production идёт LIVE **без онлайн-оплаты**. Реализован server-only kill switch,
Lava-код сохранён нетронутым.

### Флаг

`PAID_CHECKOUT_ENABLED` (`src/lib/checkout/config.ts`) — server-only, без
`NEXT_PUBLIC_`. Включено **только** при точном значении `true` (trim + lower-case);
любое другое значение и отсутствие переменной ⇒ **выключено** (fail-closed).
`default = false`.

### Поведение при `false` (текущий production)

| Точка | Поведение |
|---|---|
| `POST /api/checkout` | `503 {error, code:"PAID_CHECKOUT_DISABLED"}` до валидации тела; `Order` не создаётся и не меняется |
| `POST /api/payments/create` | `503` до обращения к Lava; Lava не вызывается |
| `POST /api/contracts/preview` | `503`; новый snapshot договора не генерируется |
| `POST /api/contracts/pdf` | `503`; новый PDF прав не генерируется, `Order` не меняется |
| `POST /api/lava/webhook` | подпись всё равно проверяется; затем `200 {ok:true, ignored:true, reason:"paid_checkout_disabled"}` — БД не трогается |
| `/beats/[slug]`, `/checkout/[slug]`, `/checkout/{preview,payment,rights}/[id]` | вместо CTA — блок «Онлайн-оплата временно недоступна» / «Online payments are temporarily unavailable» + ссылка в Telegram; каталог, плеер, регистрация, профиль, админка работают |
| `/profile` | импортированные заказы и история покупок видны **только для чтения**; ссылка «Заполнить передачу прав» скрыта |
| `POST /api/beats/[id]/purchase` (бесплатный loyalty-flow) | **не тронут** — не создаёт `Order` и не обращается к платежам |

### Тесты

`src/lib/checkout/config.test.ts` (5) + `src/lib/checkout/paid-checkout-guard.test.ts`
(18): выключено по умолчанию; только `"true"` включает; `503` (не `500`) с
предсказуемым `code`; guard стоит раньше любой записи `Order` / вызова Lava /
генерации договора / парсинга тела; ни одной активной точки входа в платный
checkout в UI мимо флага. `npm test` — **202 pass / 0 fail**. Включённый flow
(`PAID_CHECKOUT_ENABLED=true`) остаётся рабочим — существующие тесты checkout/
payments/contracts проходят без изменений.

### Backlog-этап: «Подключение платёжных систем и генерации договоров»

Отдельная будущая работа, вне текущего cutover:

1. Получить и завести в Production env: `LAVA_API_BASE_URL`, `LAVA_API_KEY`,
   `LAVA_WEBHOOK_SECRET`, `SELLER_*`, `SELLER_SIGNATURE_PATH`.
2. Проверить Lava sandbox: `create` → webhook (валидная и невалидная подпись) →
   смена статуса заказа → beat `sold`.
3. Проверить генерацию: HTML-превью договора, PDF прав, подпись продавца.
4. Прогнать платный E2E на Preview.
5. Выставить `PAID_CHECKOUT_ENABLED=true` в Production, redeploy, prod smoke уже
   **с** платёжным сценарием.
6. Обновить `.env.example` и этот раздел (режим → «включено»).

---

## Артефакты этой ветки (`release/production-cutover`)

- `974d6cb` — `ops/hamloprod/` backup + restore-test + systemd
- `cb276bf` — `deploy/preview-db/{pg_hba.conf,gen-internal-pg-cert.sh}`,
  переписанный `postgres-tls.md`, `docs/production-cutover.md`, `docs/legacy-restore.md` §5
- `<этот commit>` — `PAID_CHECKOUT_ENABLED` kill switch (`src/lib/checkout/*`,
  `src/components/checkout/payments-disabled-notice.tsx`, guards в 5 API-роутах +
  6 страницах), `.env.example`, разделы 3/4/5/7/12 этого документа

Бэкап `/home/deploy/backups/hamloprod/production-20260910T194248Z-manual`
(+ off-box) оставлен на месте.
