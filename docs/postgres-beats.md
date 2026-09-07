# Beats on PostgreSQL — M2

Metadata битов, публичный каталог и Admin Beat CRUD переведены на PostgreSQL.
Supabase в beat path **не используется** — ни как backend, ни как fallback.

Ветка `migration/self-hosted-backend`. Основа: `935ccd6`.

---

## 1. Модели и DTO

Три уровня (`src/types/beat.ts`):

| Тип | Назначение | Ключи хранилища |
|---|---|---|
| `BeatRecord` | внутренняя persistence-модель (зеркало Prisma `Beat`) | все, включая `masterKey` / `archiveKey` |
| `Beat` | **публичный** DTO (каталог, страница бита) | нет; `coverImageUrl` / `previewUrl` — резолвнутые сервером URL или `null` |
| `AdminBeat` | admin-список / деталь (доверенный UI) | `coverKey` / `previewKey` / `masterKey` / `archiveKey` + флаги `hasCover…hasArchive` |

Публичный ответ **никогда** не содержит: `masterKey`, `archiveKey`, `coverKey`,
`previewKey`, приватных URL, `UploadIntent`, `previewStoragePath` / `wavFilePath`
и прочих служебных путей, `publishedAt`, `durationSeconds` (наружу идёт
форматированное `duration` `MM:SS`).

Мапперы — `src/lib/data/beat-mappers.ts` (чистые, с инъекцией
`resolvePublicUrl`). Публичный URL строится сервером из public-ключа через
`src/lib/storage/public-url.ts` (`getS3Config().publicBaseUrl`); при отсутствии
ключа или ненастроенном storage → `null`.

---

## 2. Репозиторий и сервис

- `BeatRepository` (`src/lib/data/repositories/beat.repository.ts`) —
  `list` (limit 1–100, offset ≥ 0, фильтры `status` / `statusIn` / `featured` /
  `publishedOnly`, сортировка **`createdAt desc, id desc`**), `findById`,
  `findBySlug`, `findByCaseNumber`, `create`, `update`, `delete`.
  **Нет `reserve`** — резервирование и продажа принадлежат `OrderRepository` и
  одной транзакции (M5).
- `PrismaBeatRepository` (`src/lib/data/postgres/beat.postgres.ts`) — Prisma,
  без Supabase, без mock. `P2002` (unique) пробрасывается для сервиса,
  `P2025` (нет строки) → `null` / `false`. `isUniqueViolation()` различает
  `slug` / `caseNumber`.
- `BeatService` (`src/lib/beats/service.ts`) — Zod-валидация
  (`beatCreateSchema` / `beatUpdateSchema`, `.strict()`), нормализация
  (trim), server-side проверка роли ADMIN/EDITOR, discriminated result
  (`ok` / `status` 403|404|409|422). Никакого mock fallback при ошибке PostgreSQL.

### Правила статуса / публикации

- `publishedAt` выставляется **один раз** — когда бит впервые уходит из `private`
  — и больше не сбрасывается.
- Публичная видимость: `status ∈ {available, reserved}` **и** `publishedAt IS NOT NULL`.
- `reserved` показывается, но не как «доступен к покупке» (проверку `available`
  делает checkout).
- `private`, `sold` — не показываются вообще.

### Правила удаления

- `available`, `private` → удаляются.
- `reserved`, `sold` → `409 STATUS_LOCKED` (через обычный CRUD нельзя).

---

## 3. Ограничения БД

Миграция `prisma/migrations/20260907001622_beat_check_constraints` (CHECK,
Prisma Migrate их не отслеживает → drift чистый):

```
beats_price_usd_nonneg_chk       price_usd >= 0
beats_price_rub_nonneg_chk       price_rub >= 0
beats_bpm_range_chk              bpm IS NULL OR bpm BETWEEN 40 AND 300
beats_duration_nonneg_chk        duration_seconds IS NULL OR >= 0
beats_preview_size_nonneg_chk    preview_size_bytes IS NULL OR >= 0
beats_slug_not_blank_chk         length(btrim(slug)) > 0
beats_case_number_not_blank_chk  length(btrim(case_number)) > 0
beats_title_not_blank_chk        length(btrim(title)) > 0
```

Проверено: миграция с нуля (`init` + `add_auth_throttle` +
`beat_check_constraints`), `migrate status` up-to-date, drift — нет.

---

## 4. Admin Beat API

Все `runtime = "nodejs"`, `Cache-Control: no-store`, только Prisma / `BeatService`.
Из этих маршрутов удалены `createSupabaseServerClient`, `hasSupabaseEnv`,
Supabase query builder.

| Метод | Путь | Guard | Поведение |
|---|---|---|---|
| GET | `/api/admin/beats` | admin session | `{ items: AdminBeat[], total }`; query `limit/offset/status/featured` |
| POST | `/api/admin/beats` | `requireAdminMutation` | создаёт metadata + UUID; **status по умолчанию `private`**; 201 `{ beat }`; 422 / 409 / 403 |
| GET | `/api/admin/beats/[id]` | admin session | `{ beat: AdminBeat }` или 404 |
| PATCH | `/api/admin/beats/[id]` | `requireAdminMutation` | частичное или полное обновление; 200 `{ beat }`; 404 / 409 / 422 |
| DELETE | `/api/admin/beats/[id]` | `requireAdminMutation` | 200 `{ ok: true }`; 404; **409** для `reserved` / `sold` |

`coverKey` / `previewKey` / `masterKey` / `archiveKey` от клиента **не
принимаются** — `beatCreateSchema` / `beatUpdateSchema` объявлены `.strict()`,
любой такой ключ → 422. Файлы прикрепляются на M7.2 (см. §7).

### Общий guard

`requireAdminMutation(request)` (`src/lib/auth/guard.ts`), порядок:
Origin/Referer allow-list → 403; собственная admin-session → 401; сбой
auth/DB → 503. Возвращает `{ userId, role }`. Подключён ко всем mutation-handler'ам
в `/api/admin/*` (beats, artists, posts, releases, tracks, beats/telegram).
Старые Supabase CRUD-роуты после guard всё ещё отвечают 503 (backend недоступен),
но чужой Origin и отсутствие сессии теперь отсекаются до этого.
`/api/admin/auth/{login,logout,refresh}` сохраняют собственную обработку.

---

## 5. Публичный каталог

`src/services/content.ts` — `getBeats`, `getFeaturedBeats`, `getBeatBySlug`,
`getAdminBeats` теперь делегируют в `BeatService`. `mockBeats` удалён;
`withSupabaseFallback` для битов не используется — ошибка PostgreSQL
пробрасывается, а не подменяется mock-данными.

Прочие сущности в `content.ts` (tracks / artists / posts / releases / …) —
без изменений, всё ещё Supabase + mock fallback (переводятся отдельными этапами).

**Ограничение M2:** `getBeats()` возвращает не более 100 записей (limit сервиса).
Пагинация публичного каталога — отдельная задача, когда каталог перерастёт 100.

---

## 6. Admin Beat UI

`src/components/admin/admin-beat-crud-manager.tsx` переписан: metadata-only,
без `hasSupabase`, без Supabase Storage. Создание/редактирование/удаление —
через новый API; после `POST` используется UUID из PostgreSQL. Поля выбора
файлов отрисованы **disabled** с подсказкой «Подключение Contabo выполняется
следующим этапом». Fake URL / пользовательские object keys не отправляются.

---

## 7. Файлы — на M7.2

`cover` / `preview` / `master` / `archive` не входят в M2. На M7.2:
`UploadIntent` (модель уже есть) → presigned PUT в Contabo → `finalize`
(HeadObject + сверка) → отдельный serverside путь привязки проверенного ключа
к биту (не через `beatCreateSchema`). До этого новый бит остаётся `private`.

---

## 8. Оставшиеся Supabase imports (вне M2)

Beat path — **чист** (проверяется тестом `src/lib/beats/no-supabase.test.ts`).

Ещё на Supabase (легаси, отдельные этапы):
`src/lib/auth/public-session.ts`, `src/components/auth/*`,
`src/app/auth/callback/route.ts`, `src/lib/supabase/*`,
`src/lib/contracts/{pdf,preview}.ts`, `src/lib/payments/create.ts`,
`src/services/content.ts` (tracks/artists/posts/releases/comments/settings/…),
`src/app/api/admin/{artists,posts,releases,tracks}/*` (БД через Supabase → 503),
`src/app/api/admin/beats/[id]/telegram/route.ts`,
`src/app/api/{comments,favorites,artist-posts,feedback,checkout,contracts,payments,lava,loyalty}/*`,
`src/app/api/{beats,tracks}/[id]/{download,stream,purchase,reaction}/*`,
`src/components/admin/admin-{artist,post,release,track}-crud-manager.tsx`.
Пакеты `@supabase/*` не удалены.

---

## 9. Проверки (выполнены)

`prisma validate` ✓ · migrate с нуля (3 миграции) ✓ · `migrate status` up-to-date ✓ ·
schema drift — нет ✓ · `npm test` 147 / 147 (вкл. БД-тесты репозитория) ✓ ·
`npm run lint` 0 errors ✓ · `npm run build` ✓.

HTTP smoke (`next start`, production): login → cookie · `POST /api/admin/beats`
с `coverKey` → 422 (`.strict()`) · чистый `POST` → 201, `status=private`,
`publishedAt=null` · чужой Origin → 403 · без сессии → 401 · дубль slug → 409 ·
admin GET list/by-id · `PATCH status=available` → `publishedAt` выставлен ·
публичный `/beats` и `/beats/<slug>` показывают бит, приватных ключей в HTML нет ·
`PATCH status=private` → публичная страница 404 · delete `reserved` → 409 ·
delete `private` → 200 · GET удалённого → 404 · logout. Тестовые данные удалены.

---

## 10. Точное ТЗ M7.2 — UploadIntent + Contabo для битов

Предусловие (владелец): `hamloprod-public` / `hamloprod-private`, отдельный
access key, bucket policies, CORS — созданы и проверены smoke `docs/storage-migration.md §5.2`.

1. **`UploadIntentRepository` + `PrismaUploadIntentRepository`** поверх модели
   `UploadIntent` (уже в схеме): `create(PENDING)`, `findPendingByKey`,
   `markFinalized(key, actualSize)`, `markAttached(key)`, `expireStale(batch)`.
2. **Подключить storage API к Prisma:**
   - `POST /api/admin/storage/upload-url` — после генерации ключа создаёт
     `UploadIntent` `PENDING` (`ownerId` из сессии, `entityType="beat"`,
     `entityId=<beatId>`, `kind`, `visibility`, `expectedSize`, `contentType`,
     `expiresAt = now + 5m`). Возвращает presigned PUT (уже реализовано).
   - `POST /api/admin/storage/finalize` — принимает только существующий `PENDING`
     с этим `key`; после `HeadObject` пишет `actualSize` + `finalizedAt` →
     `FINALIZED`; сверяет `contentType` / размер по `UPLOAD_RULES`.
3. **Привязка к биту** — новый маршрут `POST /api/admin/beats/[id]/assets`
   (guard `requireAdminMutation`): body `{ kind, key }`; проверяет
   `keyMatchesKind(key, kind)` и что `UploadIntent` в статусе `FINALIZED`,
   `entityId === beatId`, `ownerId === session.userId`; в одной транзакции
   пишет `beat.<coverKey|previewKey|masterKey|archiveKey>` и
   `UploadIntent → ATTACHED` (`attachedAt`). Старый ключ (если был) — на cleanup.
4. **`BeatService`** — метод `attachAsset(beatId, kind, key, actorRole)` с этой
   логикой; `beatCreateSchema` / `beatUpdateSchema` по-прежнему **не** принимают
   ключи.
5. **Правило публикации** (уточнение M2): при переходе бита в `available`
   требовать наличие `coverKey` **и** `previewKey` (иначе 409
   `MISSING_REQUIRED_ASSETS`); `masterKey` — обязателен для продажи (проверять
   на M5).
6. **Клиентский хелпер** `src/lib/storage/client-upload.ts`:
   `requestUploadUrl(kind, beatId, file) → PUT по presigned → finalize → attach`;
   прогресс, отмена, таймаут; без S3-кредов на клиенте.
7. **Admin Beat UI** — включить disabled file-поля: после `create` бита
   загрузка идёт по `beatId`; показывать `hasCover/hasPreview/hasMaster/hasArchive`;
   публичные URL брать из ответа attach/`AdminBeat`, не строить на клиенте.
8. **Cleanup** просроченных `PENDING` / `DELETING` `UploadIntent` — оппортунистический
   sweep (как у `AuthThrottle`), плюс удаление осиротевшего объекта в Contabo
   после смены `beat.<...>Key`.
9. **Тесты:** `UploadIntentRepository` (`*.db.test.ts`), `finalize` принимает
   только `PENDING`, `attach` проверяет владельца/entity/`keyMatchesKind`,
   `beatCreateSchema` по-прежнему отвергает ключи, публикация без cover/preview → 409,
   клиентский хелпер (mock fetch).
10. **Гейты:** создание бита со всеми 4 файлами через Contabo на Preview;
    публичный рендер обложки и плеера превью; приватные WAV/ZIP недоступны
    анонимно; `lint` / `build` / `test`; отдельный commit M7.2;
    `STORAGE_BACKEND` в проде — не раньше M10.
