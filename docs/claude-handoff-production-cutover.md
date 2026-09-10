# ТЗ для Claude Code: HamloProd M10 — безопасный production cutover

Дата: 2026-09-10
Репозиторий: `/home/deploy/projects/hamloprod-web`
Исходная ветка: `migration/self-hosted-backend`
Production-домен: `https://hamloprod.org`
Правильный Vercel project: `hamlo-prod-web`, project ID
`prj_8eTSyXYn7QA26RUsgZFteZgokZrL`

## Задача

Владелец разрешил выполнить production cutover HamloProd с текущего Supabase runtime на:

- Next.js на Vercel;
- PostgreSQL 16 на VPS через `db.hamloprod.org:6432` / PgBouncer;
- Contabo Object Storage (`hamloprod-public` и `hamloprod-private`).

Нужно довести M10 до реально работающего `hamloprod.org`, проверить полный пользовательский и
административный сценарий, оставить работающий backup и понятный rollback. Не ограничиваться
планом или отчётом: выполни разрешённые действия самостоятельно. Если любой STOP-gate ниже не
проходит, production не переключай или немедленно откати уже выполненное переключение.

## Уже выполнено

Ветка содержит полный перенос runtime:

- `5e5c854` — legacy accounts/orders/contracts/social import;
- `a35a331` — собственная buyer auth, bcrypt → Argon2id upgrade;
- `3647b4f` — social runtime на PostgreSQL;
- `54f4874` — checkout/orders/contracts/payments на PostgreSQL/Contabo;
- `46167bc` — admin CRUD на PostgreSQL/Contabo;
- `8a0a98a` — Supabase runtime dependency удалена;
- `aa22440` — актуальная документация и live activation status.

Проверки на момент handoff:

- `npm test`: 184/184;
- lint: 0 errors;
- build: успешно;
- Prisma: 9 миграций, drift отсутствует;
- storage smoke: 5/5;
- импорт: 404/404 S3-объекта, 41 beat, 11 releases, 198 tracks;
- Preview deployment `dpl_715gbNQ6x41pBu5rSGDiJq3LByXP` READY;
- Preview отдавал PostgreSQL-каталог, изображения и MP3 Range 206 без runtime errors;
- `db.hamloprod.org:6432` открыт, TLS hostname verification проходит;
- внешний `5432` закрыт;
- `DOCKER-USER` rate limit и fail2ban для PgBouncer активны.

Прочитай перед началом:

- `docs/legacy-restore.md`;
- `docs/storage-migration.md`;
- `docs/preview-db-connection.md`;
- `docs/postgres-foundation.md`;
- `docs/admin-auth.md`;
- `deploy/preview-db/postgres-tls.md`;
- `roadmap_v2.md`, M10/Definition of Done.

## Неприкосновенные данные

Не удалять и не коммитить:

- `/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/`;
- `.env`, `deploy/preview-db/acme.env`, `storage-admin.env`;
- DB dumps, JSON/JSONL export, ZIP, S3 credentials, Vercel tokens;
- untracked `.vscode/`, `LICENSEMAKER/`, `roadmap_v2.md`.

Не печатать секреты, connection strings, email, password hashes, договоры или PII в stdout,
commit, PR, логи и отчёт. Для проверки env выводить только имя, scope и present/missing.

Не работать в неправильном Vercel project `hamloprod-web`. Не менять соседние проекты и
контейнеры Titanor/CollabStudio.

## 1. Изолированная рабочая копия и git-gate

Не переключай текущий checkout с untracked файлами. Создай отдельный worktree от актуальной
ветки, например:

```bash
git fetch origin --prune
git worktree add /home/deploy/projects/hamloprod-web-worktrees/production-cutover \
  -b release/production-cutover origin/migration/self-hosted-backend
```

Проверь:

```bash
git merge-base --is-ancestor origin/main origin/migration/self-hosted-backend
git status --short
```

На момент handoff `main` является предком migration-ветки, а migration-ветка впереди на 22
коммита. Если это изменилось, сначала интегрируй новый `main`, разреши конфликты, повтори все
проверки и создай новый Preview. Не force-push `main`.

## 2. Повторная проверка кода

На чистом worktree:

```bash
npm ci
npm test
npm run lint
npm run build
git grep -n -E "@supabase|from ['\"]@supabase|src/lib/supabase" -- src package.json
```

Ожидание: 184/184 либо больше, lint без errors, build успешен, Supabase runtime imports = 0.
Проверь `git diff --check` и отсутствие secrets в tracked files.

## 3. STOP-gate: полный Preview E2E

Не считать фразу «вроде всё нормально» доказательством каждого пункта. Пройди и зафиксируй
результаты `docs/legacy-restore.md` §5, пункты 1–12, на deployment финального commit:

1. Главная, beats, ham, tracks, VST и все legacy media.
2. Реальное воспроизведение beat preview и track MP3; Range = 206.
3. Buyer signup → session → logout → login.
4. Legacy bcrypt login → успешный Argon2id upgrade в БД без вывода hash.
5. Admin login и CRUD track/release/post/artist; тестовые сущности удалить.
6. Создание private beat.
7. Upload и attach cover/preview/WAV/ZIP.
8. Публикация, публичная обложка и воспроизведение preview.
9. WAV/ZIP anonymous GET запрещён, signed download = 200 и байты совпадают.
10. Profile/orders/ratings/loyalty и social mutations.
11. Conditional PUT replay = 412; replace переводит старый key в `DELETING`.
12. В HTML/ответах нет private keys, credentials и DB URL.

После сценария проверь Vercel Runtime Logs: 0 Prisma initialization errors, connection timeouts и
необъяснённых 5xx. Если Preview закрыт SSO, используй owner share link или штатный Vercel bypass,
не отключая защиту production. Если E2E невозможно доказать, это STOP до production.

## 4. STOP-gate: свежесть данных и финальная дельта Supabase

Legacy DB dump датирован раньше cutover, а старый production мог продолжать принимать записи.
До переключения докажи, что между snapshot и cutover нет новых/изменённых данных, либо перенеси
дельту.

Проверь live Supabase source, используя существующие Production env/credentials безопасным
read-only способом. Сравни source и PostgreSQL минимум по:

- users/profiles;
- beats, releases, tracks, artists, posts;
- orders, contracts, purchases;
- reactions, ratings, comments, favorites, loyalty;
- storage object inventory и связи ключей в БД;
- pending/in-flight orders и платежи.

Сравнение включает count, первичные ключи, `updated_at`/последнюю дату и детерминированный hash
нормализованных строк там, где count недостаточен. В отчёте только агрегаты, без PII.

Если есть дельта:

1. Определи короткое окно запрета mutation/admin upload/purchase на старом production.
2. Сделай свежий read-only export.
3. Расширь существующие idempotent import-скрипты только при необходимости.
4. Примени delta в PostgreSQL без перезаписи новых валидных target-данных.
5. Докопируй отсутствующие S3 objects, проверь size/hash и public/private placement.
6. Повтори source/target reconciliation.

Если live source недоступен, не утверждай, что snapshot свежий. Это STOP, пока владелец явно не
подтвердит отсутствие записей после snapshot или осознанно не примет их потерю.

## 5. STOP-gate: PostgreSQL backup и restore

До production должен существовать автоматизированный backup PostgreSQL, как требует roadmap.
Если в репозитории ещё нет HamloProd backup tooling, добавь его отдельным commit по проверенному
паттерну Titanor Time, адаптированному к:

- container `hamloprod-postgres`;
- database `hamloprod`;
- локальному backup root `/home/deploy/backups/hamloprod/`;
- off-box root `/mnt/250gb/hamloprod/backups/`;
- custom-format `pg_dump -Fc`;
- manifest без row contents/PII;
- migration list/count, table row counts и checksum;
- `SHA256SUMS`;
- atomic publish staging → final;
- lock против параллельных запусков;
- retention не меньше 7 daily, 4 weekly, 3 monthly;
- systemd service/timer и failure visibility.

Перед cutover:

1. Создай backup после финальной delta.
2. Перепроверь `SHA256SUMS` локально и с `/mnt/250gb`.
3. Восстанови dump в disposable PostgreSQL 16.
4. Сравни migrations, schema/table counts, FK constraints и детерминированные row counts/hash.
5. Удали только disposable container/volume; backup оставь.
6. Включи и проверь ежедневный timer.

Нельзя считать наличие dump достаточным без успешного restore test.

Архив legacy после этого всё равно не удалять: для его удаления нужно отдельное последующее
подтверждение владельца после стабильного production периода.

## 6. PostgreSQL/PgBouncer production hardening

Проверь фактическое состояние:

- PostgreSQL только `127.0.0.1:55434`;
- PgBouncer `84.247.130.242:6432`, TLS/SCRAM;
- userlist содержит только `hamloprod_app`;
- `hamloprod_migrator` через PgBouncer отвергается;
- `hamloprod_app` DML-only, `CREATE TABLE` запрещён;
- connection limits 20/4;
- `DOCKER-USER` rate limit восстанавливается systemd unit;
- fail2ban jail читает текущий Docker log после recreation;
- `5432` извне refused/filtered;
- сертификат `db.hamloprod.org` валиден и не близок к expiry.

`deploy/preview-db/postgres-tls.md` называет backend TLS обязательным до production. Реализуй его
только после backup и disposable проверки. Учти ошибку в черновом примере: PgBouncer подключается
к hostname `postgres`, поэтому `server_tls_sslmode=verify-full` не пройдёт с сертификатом, где SAN
только `db.hamloprod.org`. Выбери один корректный вариант и зафиксируй его:

- отдельный внутренний сертификат/CA с SAN `postgres` + `verify-full`; либо
- hostname, совпадающий с SAN, без вывода трафика во внешний маршрут; либо
- явно обоснованный `verify-ca` как временный внутренний режим.

Не включай заведомо несовместимый `verify-full`. После изменения докажи `SHOW ssl = on`, TLS на
PgBouncer → PostgreSQL и отказ `sslmode=disable`. При сбое откати только TLS config по runbook,
данные PostgreSQL не откатывай.

## 7. Production environment в Vercel

Работай только с `hamlo-prod-web` / `prj_8eTSyXYn7QA26RUsgZFteZgokZrL`. Сначала сохрани безопасный
inventory текущих Production env: variable name, environment/scope и наличие значения. Значения
не выводить.

Production deployment должен получить:

```text
DATA_BACKEND=postgres
STORAGE_BACKEND=contabo-s3
DATABASE_URL=<hamloprod_app через db.hamloprod.org:6432, sslmode=verify-full,
              pgbouncer=true, connection_limit=3, pool_timeout=15, connect_timeout=10>
SESSION_SECRET=<production secret, минимум 32 байта entropy>
S3_ENDPOINT=https://usc1.contabostorage.com
S3_REGION=usc1
S3_ACCESS_KEY=<object-scoped runtime key>
S3_SECRET_KEY=<runtime secret>
S3_BUCKET_PUBLIC=hamloprod-public
S3_BUCKET_PRIVATE=hamloprod-private
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://usc1.contabostorage.com/<tenant>:hamloprod-public
NEXT_PUBLIC_SITE_URL=https://hamloprod.org
```

Также сохрани корректные существующие Production values для:

- `LAVA_API_BASE_URL`, `LAVA_API_KEY`, `LAVA_WEBHOOK_SECRET`;
- `SELLER_*` и `SELLER_SIGNATURE_PATH`;
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`;
- остальные реально используемые публичные настройки.

Правила:

- пароль внутри `DATABASE_URL` должен быть URL-encoded;
- `DIRECT_URL` не нужен Vercel runtime и не должен давать migrator доступ через публичный pool;
- `AUTH_EXTRA_ORIGINS` для production не должен содержать Preview URL; production origins уже
  входят в фиксированный allow-list кода;
- никогда не создавать `NEXT_PUBLIC_` копии secrets;
- старые Supabase Production env пока **не удалять**: они нужны предыдущему deployment при
  rollback и не читаются новым runtime;
- не менять Preview env без причины;
- после изменения env нужен новый Production build/deployment.

Если token из ignored `deploy/preview-db/acme.env` не имеет прав на env/deploy, подготовь для
владельца точный список dashboard-действий, но продолжи все независимые проверки. Не печатай
token и не запрашивай его в чат.

## 8. Миграции перед deployment

Миграции запускаются на VPS локальным `hamloprod_migrator`, не через публичный PgBouncer и не из
Vercel build.

Порядок:

1. verified backup;
2. `prisma migrate status` с локальным `DIRECT_URL`;
3. `prisma migrate deploy`;
4. повторный status: 0 pending/failed, ожидаемое число migrations;
5. DML grants app-роли на все таблицы и sequences;
6. read-only sanity query через тот же pooled `DATABASE_URL`, который использует Vercel.

На текущем target уже 9 миграций, поэтому deploy может оказаться no-op. Это нормально, но должно
быть зафиксировано. Никогда не использовать `migrate reset`, `db push` или destructive resolve.

## 9. Production deployment

Существующий Preview deployment не продвигать напрямую: он создан с Preview environment.
Создай новый Production deployment финального проверенного commit с Production env.

Предпочтительный Git flow, если `origin/main` всё ещё является предком release branch:

1. Убедись, что все новые infra/docs fixes закоммичены и Preview этого commit проверен.
2. Зафиксируй ID/URL текущего рабочего Production deployment для rollback.
3. Fast-forward `main` до release HEAD через PR merge или обычный fast-forward push.
4. Не force-push и не переписывай историю.
5. Следи за deployment именно правильного project до статуса READY.
6. Убедись, что deployment commit равен release HEAD и production alias `hamloprod.org` указывает
   на него.

Vercel переключает alias только после успешного build, поэтому старый production продолжает
работать во время сборки. Build ERROR не является поводом менять DNS или вручную направлять домен
на незавершённый deployment.

## 10. Немедленный production smoke

После READY сразу проверить в чистом браузерном контексте и HTTP:

- `https://hamloprod.org` и canonical redirect/domain;
- RU/EN public pages, beats, releases/tracks, ham, VST;
- существующие изображения и VST downloads;
- beat preview и track audio с Range 206;
- buyer signup/login/logout и legacy login;
- admin login и read pages;
- tagged admin CRUD entity с последующей очисткой;
- private beat upload cover/preview/WAV/ZIP, attach, publish и cleanup;
- private object anonymous GET запрещён, signed GET работает;
- profile/orders/loyalty/social mutations;
- contract preview/PDF без реального списания денег;
- Lava endpoint configuration и invalid-signature webhook rejection; не создавать реальный
  платёж только ради smoke;
- отсутствие secrets/private keys в HTML и API;
- security headers, cookies `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-hp_session`;
- Vercel Runtime Logs: Prisma init/timeouts/5xx;
- PgBouncer active clients/waiting, pool saturation, Postgres connections, CPU/RAM/disk;
- fail2ban и firewall unit остаются active.

Старые браузерные Supabase-сессии не переносятся в собственную session model. Разовый повторный
вход существующих пользователей после cutover является ожидаемым поведением, но успешный вход
legacy email/password обязан работать.

Тестовые production-сущности должны иметь узнаваемый префикс и быть удалены через штатный API.
Не удалять реальные legacy-данные.

Наблюдай минимум 30 минут после smoke: повтори public reads, media Range, Runtime Logs и pool
stats. Любая устойчивая 5xx, невозможность login, отсутствие каталога, неработающий player,
ошибка private access или DB saturation — rollback trigger.

## 11. Rollback

Перед deployment запиши предыдущий Vercel production deployment ID. При rollback trigger:

1. Немедленно выполни Vercel rollback/переназначь production alias на предыдущий READY deployment.
2. Проверь `hamloprod.org`, login, каталог и старый Supabase runtime.
3. Не откатывай Prisma migrations и не восстанавливай PostgreSQL backup автоматически: это может
   удалить записи, появившиеся после cutover.
4. Не удаляй новые Contabo objects.
5. Зафиксируй mutation, успевшие попасть в PostgreSQL после cutover, и подготовь их reconciliation
   с Supabase до следующей попытки.
6. Сохрани failed deployment и runtime logs для разбора без secrets.

Старые Supabase env и legacy source сохраняются до завершения стабильного периода именно ради
этого rollback.

## 12. После успешного cutover

Обнови `docs/legacy-restore.md`, `docs/storage-migration.md` и отдельный production report:

- final commit/deployment ID/URL/status/duration;
- предыдущий deployment ID;
- source/target delta result;
- backup path, размеры и SHA-256 status без содержимого;
- restore-test result;
- migrations count/status;
- каждый production smoke пункт PASS/FAIL;
- Runtime Logs и 30-minute observation;
- rollback readiness;
- остаточные риски.

Проверь ежедневный backup на следующем фактическом запуске.

Не удаляй пока:

- legacy archive;
- Supabase project/data;
- старые Supabase Production env;
- предыдущий Vercel deployment;
- pre-cutover backup.

Удаление/отключение выполняется отдельным этапом после стабильного периода и отдельного
подтверждения владельца.

## Критерий готовности

M10 завершён только когда одновременно выполнено:

- `hamloprod.org` обслуживает финальный release commit;
- public/admin/buyer runtime использует PostgreSQL и Contabo;
- финальная source delta сведена без потерь;
- Preview E2E 1–12 подтверждён;
- production smoke полностью прошёл;
- private media не доступно анонимно;
- PostgreSQL backup автоматизирован и restore доказан;
- Runtime Logs и 30-минутное наблюдение чисты;
- rollback проверен организационно и предыдущий deployment сохранён;
- документация содержит фактические результаты.

В финальном ответе сначала сообщи итог: production LIVE либо ROLLED BACK/STOPPED. Затем перечисли
deployment, commit, backup/restore, migrations, smoke, наблюдение и оставшиеся риски. Не называй
работу завершённой при открытом STOP-gate.
