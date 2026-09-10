# Claude Code handoff: завершить миграцию HamloProd с Supabase

## Цель

Завершить перенос `hamloprod.org` с Supabase на собственный PostgreSQL и Contabo Object Storage. Работать в ветке `migration/self-hosted-backend`, публиковать и тестировать только Vercel Preview. Production не переключать.

Работай автономно до прохождения выходных проверок. Не ограничивайся анализом или планом: вноси изменения, запускай миграции, импорт, тесты, коммиты и push. Пользователю давай по одному конкретному ручному действию только тогда, когда без его панели или sudo продолжить нельзя.

## Текущее состояние

- Репозиторий: `/home/deploy/projects/hamloprod-web`.
- Ветка: `migration/self-hosted-backend`.
- Последние коммиты:
  - `9fc8b2b feat(migration): restore legacy posts and site settings`
  - `0049d4d feat(migration): restore legacy catalog and activate storage`
  - `9047196` — подготовка безопасного Preview → PostgreSQL.
- Не трогать пользовательские untracked-файлы и каталоги: `.vscode/`, `LICENSEMAKER/`, `roadmap_v2.md`.
- PostgreSQL: контейнер `hamloprod-postgres`, host loopback `127.0.0.1:55434`.
- PgBouncer: `db.hamloprod.org:6432`, TLS, transaction pooling. Порт 5432 снаружи закрыт.
- `hamloprod-db-firewall.service` активен и enabled. В `DOCKER-USER` сначала fail2ban, затем hashlimit для 6432; без unconditional DROP.
- Изолированная восстановленная старая БД: контейнер `hamloprod-supabase-import-db`, `--network none`.
- Исходный storage ZIP:
  `/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/source/wkxfxtdrlqxrwuaenizh.storage.zip`
- Распакованные файлы:
  `/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/storage`
- Backup старой БД:
  `/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/database/db_cluster-08-09-2026@13-12-31.backup`
- Storage manifest:
  `/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/manifests/storage-import.jsonl`
- Все эти файлы должны оставаться вне git. Не удалять ZIP, backup, распакованный архив или manifest до полной проверки и отдельного финального подтверждения пользователя.

## Критическая особенность Vercel

В аккаунте существуют два проекта с похожими именами:

1. Правильный: `hamlo-prod-web`, project ID `prj_8eTSyXYn7QA26RUsgZFteZgokZrL`. В нём production и Preview env.
2. Ошибочный дубль: `hamloprod-web`, project ID `prj_o5XpBl0TbPVHFjaTMoYKueLW9c8B`. В нём нет env; страницы падают с `Environment variable not found: DATABASE_URL`.

Использовать только `hamlo-prod-web`. Локальный `.vercel/project.json` уже исправлен на правильный project ID. Не давать пользователю ссылки из проекта-дубля. Не удалять дубль без явного подтверждения пользователя.

Рабочий branch alias:
`https://hamlo-prod-web-git-migration-sel-bf2e3e-inkeritm-4372s-projects.vercel.app`

Последний правильный Preview deployment для `9fc8b2b`: `dpl_CyobY1BbtYjYWPXTvsRt9YMgpT8a`, статус READY.

Vercel API token находится в ignored-файле `deploy/preview-db/acme.env`. Не печатать его и не коммитить. Для защищённых Preview использовать Vercel MCP `web_fetch_vercel_url` или временную share URL.

## Что уже перенесено и проверено

### Storage

- В Contabo загружено 404 объекта, 1,703,159,876 байт.
- Public: 145 объектов / 395,723,897 байт.
- Private: 259 объектов / 1,307,435,979 байт.
- Ключи сохранены под `legacy-supabase/<old-bucket>/<old-path>`.
- Public bucket: `hamloprod-public`; private bucket: `hamloprod-private`.
- Public bucket policy разрешает только anonymous `s3:GetObject` на public bucket.
- Private bucket не имеет public policy.
- CORS применён к обоим bucket.
- `npx tsx scripts/storage-smoke.mts` проходит 5/5.
- Реальные импортированные MP3 и изображения отвечают корректно; Range для MP3 даёт 206.
- Admin credentials находятся в ignored-файле `deploy/preview-db/storage-admin.env`, mode 600. Runtime app key имеет только object-level доступ. Не смешивать эти ключи и не печатать значения.

### Контент

- Beats: 41/41 в PostgreSQL.
- Releases: 11/11.
- Tracks: 198/198; 197 audio; связи с релизами сохранены.
- Posts: 1/1.
- Site settings: 1/1.
- Старые public Supabase URLs публикации переписываются на Contabo.
- `/en/ham` локально показывал импортированные релизы и синглы.
- `/api/tracks/<id>/stream` локально выдавал signed URL; private MP3 отвечал 206.
- Правильный Preview `/en/vst` проверен: HTTP 200, публикация `HamloProd Drum Engine Beta 0.1`, три изображения и `.exe` доступны.

### Последняя полная проверка

- `npm test`: 166/166.
- `npm run lint`: 0 errors, 12 warnings в ранее существовавших файлах.
- `npm run build`: успешно.
- `npx prisma migrate status`: база актуальна, 5 migrations.

## Что осталось перенести

Старая БД содержит:

- `auth.users`: 4 пользователя; 3 password/email identity, 1 Google identity.
- `public.profiles`: 1 admin profile.
- `orders`: 3.
- `contracts`: 3.
- `beat_purchases`: 9.
- `beat_reactions`: 3.
- `content_comments`: 1.
- `content_ratings`: 1.
- `user_loyalty_points`: 2.
- `beat_downloads`: 0.
- `track_downloads`: 0.

Также остаются runtime-пути, которые всё ещё используют Supabase:

- public buyer auth/session и компоненты входа/выхода;
- profile, checkout, payments, contracts;
- favorites, reactions, ratings, comments, loyalty, purchases/download logs;
- artist data/posts, если они реально используются;
- admin CRUD для tracks/releases/posts и их клиентские загрузки.

Найти полный остаток командой:

```bash
rg -n "Supabase|supabase|createSupabase" src
```

## Обязательный порядок работ

### 1. Зафиксировать baseline

Проверить branch/status, контейнеры, миграции и counts. Не добавлять в git пользовательские untracked-файлы. Не выводить email, password hashes, buyer passport/phone, токены или секреты в терминальные логи и ответы.

### 2. Экспортировать оставшиеся данные

Экспортировать из `hamloprod-supabase-import-db` в JSONL внутри:

`/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/database/`

Файлы mode 600. Сохранять UUID, даты и связи. В stdout выводить только количества и результаты валидации, без PII и password hashes.

### 3. Расширить Prisma schema

Добавить нормальные PostgreSQL-модели для пользователей и всех перечисленных сущностей. Сохранить legacy UUID. Добавить FK, unique constraints, indexes и check constraints, эквивалентные старой БД.

Особое внимание:

- `User` уже существует; импортировать все 4 auth users.
- Legacy password hashes Supabase — bcrypt (`$2...`), а текущий собственный admin auth принимает Argon2id. Добавить безопасную проверку bcrypt и после успешного входа обновлять hash до Argon2id. Не ослаблять защиту от enumeration/rate limit.
- Google-only account должен быть сохранён с `passwordHash = null` и не потерять связанную историю. Не создавать ему известный/default password. Если Google OAuth ещё не реализуется, UI должен честно сообщать о способе восстановления доступа.
- Roles привести к Prisma enum (`admin` → `ADMIN`, и т. п.).
- Старые `download_token`, passport, phone и другие чувствительные поля не логировать.
- Пути PDF/файлов переписать в storage keys только после проверки наличия соответствующих объектов.

Создать reviewable migration SQL. Применять DDL только через `DIRECT_URL`/локальный migrator, никогда через PgBouncer runtime URL.

### 4. Импортировать данные транзакционно

Сделать отдельный idempotence-guarded import script с `--dry-run` и `--apply`, как существующие `scripts/import-legacy-*.mts`.

Перед apply проверять:

- target-таблицы ожидаемо пусты;
- все user/beat/track/order FK существуют;
- UUID, enum и числа валидны;
- нет duplicate unique keys;
- количество вставок совпало с источником.

После apply сверить counts и выборочно связи без печати PII.

### 5. Перевести runtime с Supabase на Prisma

Переписать public auth, profile, checkout, purchases, loyalty, comments, ratings, reactions, favorites, download logs, contracts/payments и admin CRUD на собственный PostgreSQL/Contabo.

Требования к auth:

- httpOnly + Secure + SameSite=Lax + Path=/ cookie;
- raw session token хранится только в cookie, в БД только HMAC/hash;
- origin allow-list для mutation routes;
- login/signup/logout с одинаковой ошибкой для неизвестного email/неверного пароля;
- rate limiting;
- signup создаёт Argon2id hash;
- legacy bcrypt автоматически повышается до Argon2id после успешной проверки;
- admin routes продолжают принимать только `ADMIN`/`EDITOR`;
- buyer routes принимают обычного авторизованного пользователя;
- не логировать credentials/session tokens.

Google OAuth не имитировать. Либо реализовать корректно с отдельной конфигурацией, либо временно убрать/disable кнопку и явно описать ограничение.

Private WAV/ZIP/audio всегда выдавать только коротким presigned GET после проверки прав. Никогда не вставлять private object URL в HTML.

### 6. Удалить runtime-зависимость от Supabase

После перевода всех путей добиться отсутствия Supabase в runtime-коде. Пакеты и env удалить только когда `rg` подтвердит, что они не нужны. Миграционные scripts/docs могут упоминать Supabase как источник архива.

### 7. Проверки каждого логического коммита

Минимум:

```bash
npm test
npm run lint
npm run build
npx prisma migrate status
```

Затем локальный production server и реальные HTTP проверки PostgreSQL + Contabo. Не писать тесты, которые только повторяют реализацию; добавлять тесты для auth, authorization, legacy hash upgrade и private storage access.

Коммитить через terminal git, а не UI commit action: ранее UI упал с `unknown special value: ["bytes", ...]`. Push в `migration/self-hosted-backend` уже разрешён пользователем.

### 8. Preview deploy и полный E2E

Следить только за проектом `hamlo-prod-web` / `prj_8eTSyXYn7QA26RUsgZFteZgokZrL`. Убедиться, что deployment соответствует нужному commit SHA и READY.

Проверить на Preview:

1. Главная, beats, releases/tracks, VST post и все изображения.
2. Реальное воспроизведение preview/audio с Range.
3. Регистрация нового buyer, login/logout, повторный login.
4. Вход legacy password-пользователя и upgrade bcrypt → Argon2id без раскрытия hash.
5. Admin login и admin CRUD для beat/track/release/post.
6. Создание private beat.
7. Upload cover/preview/WAV/ZIP через upload-url → PUT → finalize → attach.
8. Публикация, public cover, реальное воспроизведение preview.
9. WAV/ZIP: anonymous GET запрещён, signed GET разрешён, байты совпадают.
10. Purchase/contract/profile history, loyalty, reactions/comments/ratings/favorites.
11. Conditional PUT replay отклоняется; замена объекта переводит старый ключ в `DELETING`.
12. В HTML нет private keys, credentials или database URL.

Проверить Vercel Runtime Logs после E2E: не должно быть Prisma initialization errors, connection timeouts или 500.

## Запреты

- Не переключать production и не менять `hamloprod.org` на Preview.
- Не открывать PostgreSQL 5432 наружу.
- Не ослаблять TLS, fail2ban, DOCKER-USER или hashlimit.
- Не добавлять wildcard origin в auth allow-list.
- Не делать private bucket публичным.
- Не использовать storage admin key в runtime/Vercel.
- Не коммитить `.env`, `acme.env`, `storage-admin.env`, JSONL, backup, ZIP или PII.
- Не удалять архивы после частичной проверки.
- Не работать с проектом-дублем `hamloprod-web`.

## Критерий завершения

Работа завершена только когда все source/target counts совпадают, runtime больше не зависит от Supabase, полный Preview E2E пройден, Runtime Logs чисты, документация обновлена и production не затронут. После этого сообщить пользователю, что архив готов к удалению, но не удалять его без отдельного подтверждения.
