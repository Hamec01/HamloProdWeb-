# Миграция хранилища на Contabo Object Storage — M7.1

Статус: подготовка. Ветка `migration/self-hosted-backend`.
Основание: `roadmap_v2.md` (разделы 4–5, 7, 16 M7), `docs/migration-from-supabase.md` (Storage).

M7.1 добавляет **параллельный** backend хранилища и direct-to-S3 upload flow,
**не переключая** существующие формы. `STORAGE_BACKEND` по умолчанию `supabase`,
runtime продолжает работать через Supabase Storage. Реальные S3-креды в код и в Git
не попадают; `NEXT_PUBLIC_` для access/secret key не создаются.

---

## 1. Карта текущего storage-кода (аудит, read-only)

### 1.1 Buckets и назначение

| Bucket | Публичный | Определён в | Содержимое |
|---|---|---|---|
| `media-images` | да | `supabase/migrations/202604100102_*` | обложки битов, обложки треков, обложки релизов, картинки постов |
| `beat-previews` | да | `supabase/migrations/202604100101_*`, `202604260102_*` | превью бита (MP3/WAV/M4A) |
| `beat-downloads` | нет | `supabase/migrations/202604100101_*` | WAV-мастер и ZIP-архив бита |
| `track-downloads` | нет | `supabase/migrations/202604100102_*` | MP3 трека (скачивание и стриминг) |
| `post-files` | да | `supabase/migrations/202604200102_*` | медиа постов артистов (image/audio) |
| `contracts-pdf` | нет | `supabase/migrations/202604160101_*` | сгенерированные PDF договоров |

Константы имён — [src/lib/storage/media.ts](../src/lib/storage/media.ts).
Политики доступа: публичные bucket — `select` для всех; приватные — только
`public.is_admin_user()` на запись, `authenticated` на чтение (`beat-downloads`
даже без owner-ограничения — см. 1.8).

### 1.2 Browser uploads (клиентские, через `@supabase/ssr` browser client)

Все загрузки сейчас идут **из браузера напрямую в Supabase Storage** под сессией
пользователя (anon key + RLS). Файл проходит через клиент, не через сервер.

| Файл | Что грузит | Bucket | Путь | upsert |
|---|---|---|---|---|
| [src/components/admin/admin-beat-crud-manager.tsx](../src/components/admin/admin-beat-crud-manager.tsx) | cover | `media-images` | `buildStoragePath(slug,"cover",name)` | `true` |
| — то же | preview | `beat-previews` | `buildBeatPreviewStoragePath(id\|slug,name)` | `true` |
| — то же | WAV | `beat-downloads` | `buildStoragePath(slug,"wav",name)` | `true` |
| — то же | ZIP | `beat-downloads` | `buildStoragePath(slug,"zip",name)` | `true` |
| [src/components/admin/admin-track-crud-manager.tsx](../src/components/admin/admin-track-crud-manager.tsx) | cover | `media-images` | `buildStoragePath(slug,"cover",name)` | `true` |
| — то же | MP3 | `track-downloads` | `buildStoragePath(slug,"mp3",name)` | `true` |
| [src/components/admin/admin-release-crud-manager.tsx](../src/components/admin/admin-release-crud-manager.tsx) | cover | `media-images` | `buildStoragePath(slug,"cover",name)` | `true` |
| — то же | track MP3 | `track-downloads` | `buildStoragePath(slug,"track",name)` | `true` |
| [src/components/admin/admin-post-crud-manager.tsx](../src/components/admin/admin-post-crud-manager.tsx) | image | `media-images` | `buildStoragePath(slug,"post-image",name)` | (default) |
| — то же | file/audio | `post-files` | `buildStoragePath(slug,"post-file",name)` | (default) |

Пути строятся из **пользовательского имени файла** (`buildStoragePath` /
`buildBeatPreviewStoragePath` только «санитайзят» его и добавляют `Date.now()`).

### 1.3 Server uploads (Route Handler, через server client)

| Файл | Что грузит | Bucket | upsert |
|---|---|---|---|
| [src/app/api/artist-posts/route.ts](../src/app/api/artist-posts/route.ts) | image/audio поста артиста | `post-files` | `false` |
| [src/lib/contracts/pdf.ts](../src/lib/contracts/pdf.ts) | PDF договора | `contracts-pdf` | `true` |

`artist-posts` проверяет `getPublicSessionState()` + `profiles.role` in (admin/editor)
или `profiles.artist_id === artistId`. `contracts/pdf` проверяет владельца заказа.

### 1.4 Public URL

`supabase.storage.from(bucket).getPublicUrl(path)` — вызывается для `media-images`,
`beat-previews`, `post-files` в тех же местах, что и upload (см. 1.2–1.3).
Полученный публичный URL сохраняется в БД (`cover_image_url`, `preview_url`,
`image_url` и т.п.) вместе с относительным путём.

### 1.5 Signed download URL

| Файл | Bucket | TTL | Auth |
|---|---|---|---|
| [src/app/api/beats/[id]/download/route.ts](../src/app/api/beats/[id]/download/route.ts) | `beat-previews` | 60 с | login + `available_for_download` |
| [src/app/api/tracks/[id]/download/route.ts](../src/app/api/tracks/[id]/download/route.ts) | `track-downloads` | 60 с | login + лог скачивания |
| [src/app/api/tracks/[id]/stream/route.ts](../src/app/api/tracks/[id]/stream/route.ts) | `track-downloads` | 3600 с | нет (публичные треки), **service-role** client |
| [src/lib/contracts/pdf.ts](../src/lib/contracts/pdf.ts) | `contracts-pdf` | 3600 с | владелец заказа |

WAV/ZIP бита (`beat-downloads`) сейчас через signed URL **не выдаются** — выдача
покупателю не реализована (это M9 / отдельный flow).

### 1.6 Delete / replace

- **Replace** — все клиентские загрузки используют `upsert: true`, но путь каждый раз
  новый (`Date.now()` в имени), поэтому старый файл не перезаписывается, а **остаётся
  осиротевшим**.
- **Delete** — удаление бита/трека/релиза/поста ([src/app/api/admin/beats/[id]/route.ts](../src/app/api/admin/beats/[id]/route.ts) и аналоги)
  делает только `supabase.from(...).delete()` по строке БД. **Объекты в Storage не
  удаляются никогда** — ни `storage.remove()`, ни cleanup-задачи в коде нет.

### 1.7 Ограничения типов и размеров

| Где | MIME | Расширения | Размер |
|---|---|---|---|
| Beat preview (клиент, [src/lib/validations/beat.ts](../src/lib/validations/beat.ts)) | `audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/mp4, audio/x-m4a` | `.mp3 .wav .m4a` | **20 MB** (`PREVIEW_MAX_SIZE_BYTES`) |
| Beat cover | `image/*` (только атрибут `accept`) | — | не проверяется |
| Beat WAV / ZIP | только `accept` в `<input>` | — | не проверяется |
| Track cover / MP3 | только `accept` | — | не проверяется |
| Artist post image/audio | нет серверной проверки | — | не проверяется |

Вывод: кроме превью бита, **серверной валидации MIME/размера при загрузке нет** —
браузер сам решает, что и какого размера отправить в Storage.

### 1.8 Проблемы, обнаруженные в аудите

1. **Ключи из имён файлов.** `buildStoragePath` использует пользовательское имя как
   основу пути. M7.1 это заменяет генератором ключей на UUID (см. 2.3).
2. **Загрузка напрямую из браузера в Supabase.** Перенести S3-креды в браузер нельзя.
   M7.1 вводит presigned PUT + серверную авторизацию (см. 2.2).
3. **Нет серверной валидации** MIME/размера/визибилити для большинства типов.
   M7.1 вводит серверную таблицу правил (см. 2.4).
4. **Осиротевшие файлы** при replace и delete — cleanup не реализован. Остаётся
   открытым; предложение — в разделе 9 (M7.2+).
5. **`beat-downloads` RLS без owner-ограничения** (унаследовано, отмечено в M0). Для
   Contabo приватный bucket + signed URL после проверки прав — уже часть модели.
6. **Расхождение лимита превью:** клиент — 20 MB, спецификация M7.1 — 30 MB. В новой
   таблице правил `beat-preview` = 30 MB (как в ТЗ); согласовать в M7.2 при переключении UI.

---

## 2. Целевая архитектура M7.1 (что добавлено)

### 2.1 Новые модули (server-only)

| Файл | Назначение |
|---|---|
| [src/lib/storage/config.ts](../src/lib/storage/config.ts) | строгая проверка env, HTTPS-only endpoint, разбор `S3_FORCE_PATH_STYLE`, `getStorageBackend` (fail-closed), `describeStorageConfig` (только booleans + host, без значений) |
| [src/lib/storage/keys.ts](../src/lib/storage/keys.ts) | генерация ключей на `crypto.randomUUID()` + UUID сущности, `assertSafeObjectKey` (запрет traversal / ведущего slash / `..` / `\` / `//` / control-символов), `keyMatchesKind` |
| [src/lib/storage/upload-rules.ts](../src/lib/storage/upload-rules.ts) | серверная таблица правил (visibility / MIME / расширения / размер), `validateUploadRequest`, `validateFinalizedObject`, `bucketForVisibility` |
| [src/lib/storage/contabo-s3-storage.ts](../src/lib/storage/contabo-s3-storage.ts) | адаптер `DirectUploadStorage` поверх `@aws-sdk/client-s3`: `putObject` (create-only), `deleteObject` (идемпотентный), `getPublicUrl` (запрет private), `createSignedDownloadUrl` (300–900 с), `createSignedUploadUrl` (≤ 600 с), `headObject` |
| [src/lib/storage/upload-service.ts](../src/lib/storage/upload-service.ts) | транспорт-независимая логика `upload-url` / `finalize` (без `next/*`), инъекция storage-порта для тестов |
| [src/app/api/admin/storage/upload-url/route.ts](../src/app/api/admin/storage/upload-url/route.ts) | `POST` — presigned PUT, TTL 5 мин, требует admin/editor session |
| [src/app/api/admin/storage/finalize/route.ts](../src/app/api/admin/storage/finalize/route.ts) | `POST` — HeadObject + сверка bucket/MIME/размера/соответствия ключа виду |

Интерфейс расширен в [src/lib/storage/object-storage.ts](../src/lib/storage/object-storage.ts)
(`DirectUploadStorage`, `SignedUpload`, `ObjectHead`) — аддитивно, старый `ObjectStorage` не изменён.

Зависимости (закреплённые точные версии): `@aws-sdk/client-s3@3.1127.0`,
`@aws-sdk/s3-request-presigner@3.1127.0`, dev: `tsx@4.23.13` (раннер тестов
`node --test` для TS без бандлера; на `next build` / `next lint` не влияет).

### 2.2 Direct-to-S3 upload flow

```
браузер (admin/editor)
  │  POST /api/admin/storage/upload-url { kind, entityId, originalFileName, contentType, size }
  ▼
сервер: session → validateUploadRequest → generateObjectKey → presigned PUT (TTL 5 мин)
  │  ← { key, visibility, upload:{ url, method:PUT, headers }, expiresAt, publicUrl? }
  ▼
браузер: PUT файла напрямую в Contabo по выданному URL (WAV/ZIP НЕ идут через Vercel)
  │
  │  POST /api/admin/storage/finalize { key, kind }
  ▼
сервер: session → assertSafeObjectKey → keyMatchesKind → HeadObject → сверка MIME/размера
  │  ← { storage: { key, visibility, contentType, size, etag, publicUrl? } }
  ▼
браузер: сохраняет подтверждённый storage reference в форму бита (в M7.2)
```

Access key / secret key остаются на сервере. Клиент получает только временный URL на
один заранее сгенерированный ключ. `finalize` не принимает произвольный bucket/key:
bucket вычисляется из visibility вида, ключ обязан структурно соответствовать виду.

### 2.3 Object keys

```
beats/<beat-id>/cover/<uuid>.<ext>       tracks/<track-id>/cover/<uuid>.<ext>
beats/<beat-id>/preview/<uuid>.mp3       tracks/<track-id>/audio/<uuid>.mp3
beats/<beat-id>/master/<uuid>.wav        artists/<artist-id>/avatar/<uuid>.<ext>
beats/<beat-id>/archive/<uuid>.zip       posts/<post-id>/<uuid>.<ext>
```

`<beat-id>` и т.п. — UUID сущности (проверяется); `<uuid>` — свежий
`crypto.randomUUID()`. Для `preview/master/archive/audio` расширение фиксировано
и имя файла пользователя игнорируется полностью.

### 2.4 Серверная таблица правил загрузки

| kind | visibility | MIME | Расширения | Макс. размер |
|---|---|---|---|---|
| `beat-cover` | public | `image/jpeg, image/png, image/webp` | jpg jpeg png webp | 10 MB |
| `beat-preview` | public | `audio/mpeg` | mp3 | 30 MB |
| `beat-master` | private | `audio/wav, audio/x-wav, audio/wave, audio/vnd.wave` | wav | 500 MB |
| `beat-archive` | private | `application/zip, application/x-zip-compressed` | zip | 2 GB |
| `track-cover` * | public | image/* (jpeg/png/webp) | jpg jpeg png webp | 10 MB |
| `track-audio` * | private | `audio/mpeg` | mp3 | 30 MB |
| `artist-avatar` * | public | image/* (jpeg/png/webp) | jpg jpeg png webp | 10 MB |
| `post-file` * | public | image/* + `audio/mpeg` | jpg jpeg png webp mp3 | 30 MB |

`*` — провизорные правила, финализируются в M7.2+ вместе с их UI. Четыре `beat-*` —
авторитетный набор M7.1.

Проверяется на сервере: **admin/editor** через текущую серверную Supabase-сессию
(`getAdminSessionState`), UUID сущности, MIME, расширение, согласованность
MIME↔расширение, размер, соответствие `kind` ↔ `visibility` ↔ структура ключа.

---

## 3. Mapping: Supabase buckets → Contabo

| Старый bucket | Целевой bucket | Новый префикс ключа |
|---|---|---|
| `media-images` (обложки битов) | `hamloprod-public` | `beats/<beat-id>/cover/<uuid>.<ext>` |
| `media-images` (обложки треков) | `hamloprod-public` | `tracks/<track-id>/cover/<uuid>.<ext>` |
| `media-images` (обложки релизов) | `hamloprod-public` | `releases/<release-id>/cover/<uuid>.<ext>` (в M7.2, отдельный kind) |
| `media-images` (картинки постов) | `hamloprod-public` | `posts/<post-id>/<uuid>.<ext>` |
| `beat-previews` | `hamloprod-public` | `beats/<beat-id>/preview/<uuid>.mp3` |
| `beat-downloads` (WAV) | `hamloprod-private` | `beats/<beat-id>/master/<uuid>.wav` |
| `beat-downloads` (ZIP) | `hamloprod-private` | `beats/<beat-id>/archive/<uuid>.zip` |
| `track-downloads` | `hamloprod-private` | `tracks/<track-id>/audio/<uuid>.mp3` |
| `post-files` | `hamloprod-public` | `posts/<post-id>/<uuid>.<ext>` |
| `contracts-pdf` | `hamloprod-private` | `contracts/<order-id>/<uuid>.pdf` (в M9, вне M7.1) |

Перенос существующих файлов (copy old→new, сверка checksum, замена ссылок в БД) —
этапы M8 (public) и M9 (private). M7.1 только готовит инфраструктуру и код.

---

## 4. Настройка Contabo — статус M7.2a

> Секреты (`S3_*`) в чат/Git/логи не выводятся. `usc1` endpoint и path-style
> подтверждены; `S3_*` уже в локальном `.env` и валидны.

### 4.1 Bucket'ы — **созданы** ✓

```
hamloprod-public     — обложки, превью MP3, аватары, медиа постов
hamloprod-private    — WAV-мастера, ZIP, приватные треки, (позже) договоры
```

Проверено скриптом: `HeadBucket` на обоих → OK; `ListObjectsV2` под ключом → пусто.
Bucket `250gb` не тронут.

### 4.2 Технический access key — **есть** ✓ (object-scoped)

Ключ в `.env` даёт: `PutObject`, `GetObject`, `DeleteObject`, `HeadObject`,
`HeadBucket`, `ListObjectsV2`, presigned GET/PUT. **Не даёт** bucket-администрирования:
`GetBucketPolicy` / `PutBucketPolicy` / `GetBucketCors` / `PutBucketCors` /
`PutBucketAcl` → `AccessDenied 403`.

### 4.3 Bucket policy — **действие владельца** (панель Contabo)

Технический ключ не может применить policy (см. 4.2). В **Contabo customer panel**
→ Object Storage → `hamloprod-public` → включить публичный доступ / применить
policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AnonymousGetObject",
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::hamloprod-public/*"]
    }
  ]
}
```

- анонимный `s3:GetObject` → разрешён; `ListBucket` / `PutObject` / `DeleteObject`
  анонимно **не** гранятся (остаются запрещёнными по умолчанию — проверено live:
  anon PUT → 403, anon DELETE → 403, anon list → 401).
- `hamloprod-private` — **policy не ставить**. Анонимный доступ отсутствует по
  умолчанию (проверено live: anon GET private → 401). Чтение — только presigned URL
  от сервера (проверено live: presigned GET → 200).

Источник policy/CORS в коде: [src/lib/storage/bucket-admin.ts](../src/lib/storage/bucket-admin.ts)
(`buildPublicReadPolicy`, `buildCorsRules`). Скрипт
[scripts/storage-provision.mts](../scripts/storage-provision.mts) применяет их и
печатает точный JSON, если ключ получит права или запуск сделают под admin-ключом
(`npx tsx scripts/storage-provision.mts` / `--check`).

### 4.4 CORS — **действие владельца** (панель Contabo)

Тем же ключом `PutBucketCors` → `AccessDenied`. Применить на **оба** бакета в панели:

```json
[
  {
    "AllowedOrigins": ["https://hamloprod.org", "https://www.hamloprod.org", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Wildcard origin не использовать. CORS нужен только для direct-PUT/GET из браузера
(M7.2b) — на серверный smoke (Node `fetch`) не влияет.

### 4.5 Env

`S3_*` уже заполнены в локальном `.env` и на используемом Contabo. После включения
публичного доступа (4.3) **проверить публичный base URL**: если Contabo отдаёт
`https://usc1.contabostorage.com/<projectId>:hamloprod-public/<key>` (с префиксом
проекта) — задать `S3_PUBLIC_BASE_URL` явно; иначе `config.ts` строит
`${S3_ENDPOINT}/hamloprod-public` (проверено: этот путь используется для
put/get/presign и работает). `S3_ACCESS_KEY` / `S3_SECRET_KEY` — без `NEXT_PUBLIC_`.

---

## 5. Live S3 smoke — M7.2a (реальный Contabo)

`npx tsx scripts/storage-smoke.mts` — вывод без секретов/подписанных URL:

| # | Проверка | Результат |
|---|---|---|
| 1 | public put → **anonymous GET 200** | **FAIL — 401**. Bucket `hamloprod-public` ещё не публичный: техническому ключу `PutBucketPolicy` → `AccessDenied`. Разблокируется действием владельца (4.3) |
| 2 | private put → anonymous GET 401/403 | **PASS — 401** |
| 3 | private **presigned GET 200** | **PASS — 200, body-ok** |
| 4 | delete обоих тестовых объектов | **PASS** |
| 5 | HeadObject после delete → отсутствуют | **PASS** (public gone, private gone) |

**SMOKE: 4/5 passed.** Единственный fail — это ровно та настройка, которую
технический ключ применить не может; всё остальное (put / presigned GET / delete /
head, приватная изоляция) работает на настоящем Contabo. Тестовые объекты удалены.

После включения публичного доступа владельцем — повторить
`npx tsx scripts/storage-smoke.mts`, ожидать `5/5`.

Дополнительно для M7.2b: presigned PUT из браузера + `POST /api/admin/storage/finalize`
проверяют CORS (4.4).

---

## 6. Результаты проверок

| Проверка | Результат |
|---|---|
| `npm run lint` | 0 errors, warnings — только в существующих файлах |
| `npm run build` | ✓ Compiled successfully |
| `npm test` | все зелёные (storage: bucket выбор, безопасные ключи, MIME/ext/size, traversal, private `getPublicUrl`, конфиг, unauthorized API, подмена `key`/`kind`, TTL, идемпотентный delete, origin-check; M7.2a: policy/CORS builders) |
| Live S3 smoke (M7.2a) | **4/5** на настоящем Contabo (раздел 5): всё кроме публичного анонимного GET, который блокирован правами ключа |
| Переключение существующих форм битов | не выполнялось (вне scope M7.2a) |
| Секреты в коде/Git/выводе | нет; скрипты печатают только статусы и PASS/FAIL |

---

## 7. Оставшиеся Supabase storage imports

M7.1 ничего из этого не трогает — Supabase остаётся активным backend хранилища.

| Файл | Использование Supabase Storage |
|---|---|
| `src/lib/storage/media.ts` | имена bucket + построение путей (используется всеми ниже) |
| `src/components/admin/admin-beat-crud-manager.tsx` | browser upload: cover, preview, WAV, ZIP + `getPublicUrl` |
| `src/components/admin/admin-track-crud-manager.tsx` | browser upload: cover, MP3 + `getPublicUrl` |
| `src/components/admin/admin-release-crud-manager.tsx` | browser upload: cover, track MP3 + `getPublicUrl` |
| `src/components/admin/admin-post-crud-manager.tsx` | browser upload: image, file + `getPublicUrl` |
| `src/app/api/artist-posts/route.ts` | server upload в `post-files` + `getPublicUrl` |
| `src/app/api/beats/[id]/download/route.ts` | `createSignedUrl` (`beat-previews`, 60 с) |
| `src/app/api/tracks/[id]/download/route.ts` | `createSignedUrl` (`track-downloads`, 60 с) |
| `src/app/api/tracks/[id]/stream/route.ts` | `createSignedUrl` (`track-downloads`, 3600 с, service-role) |
| `src/lib/contracts/pdf.ts` | upload PDF + `createSignedUrl` (`contracts-pdf`, 3600 с) |

Целевая замена по roadmap: browser uploads → presigned PUT (M7.2, M8),
signed download → `ContaboS3Storage.createSignedDownloadUrl` после entitlement-check
(M8–M9), `contracts-pdf` → `contracts/<order-id>/…` (M9).

---

## 8. Риски

| # | Риск | Смягчение |
|---|---|---|
| R1 | Публичный base URL Contabo может отличаться от `${endpoint}/${bucket}` | `S3_PUBLIC_BASE_URL` как явный override; проверить в smoke (шаг 3) до переключения UI |
| R2 | Приватный bucket по умолчанию может оказаться с публичным листингом/чтением | Обязательная проверка «anonymous private GET → 403» в smoke (шаг 5) перед M7.2 |
| R3 | CORS не настроен → direct PUT из браузера не пройдёт | Раздел 4.4; отдельная проверка presigned PUT из браузера в smoke |
| R4 | Один access key на оба бакета (если Contabo не даёт scoped-ключи) | Ограничить policy на ключ, если возможно; иначе запланировать ротацию; ключ только на сервере |
| R5 | `create-only` в `putObject` делает HeadObject перед PUT (гонка + лишний запрос) | Ключи содержат `crypto.randomUUID()` — коллизия практически исключена; для presigned PUT проверка не применяется (ключ одноразовый) |
| R6 | Осиротевшие файлы при replace/delete (существующая проблема, см. 1.8) | Вне M7.1; предложение — `upload_intents` + cleanup-задача в M7.2/M9 |
| R7 | Лимит превью: 20 MB (клиент) vs 30 MB (правило M7.1) | Согласовать при переключении UI в M7.2 |
| R8 | `beat-master` MIME: браузеры иногда шлют `application/octet-stream` для WAV | Сейчас строго `audio/wav*`; при провале реальных загрузок в M7.2 — расширить правило осознанно, с проверкой расширения |
| R9 | AWS SDK требует Node.js runtime на Vercel (не Edge) | В обоих роутах задан `export const runtime = "nodejs"` |

---

## 9. Точное ТЗ M7.2b — UploadIntent + загрузка cover / preview / WAV / ZIP для битов

Цель: доставить прямую загрузку **файлов бита** в Contabo через `UploadIntent`
(модель уже в Prisma-схеме с M1.2a) и привязку проверенного объекта к биту.

**Предусловия (действие владельца, см. 4.3–4.4):**
- [ ] `hamloprod-public` сделан публичным (anon `s3:GetObject`), `hamloprod-private` — нет;
- [ ] CORS применён на оба bucket;
- [ ] повторный `npx tsx scripts/storage-smoke.mts` → **5/5**;
- [ ] если публичный URL с префиксом проекта — `S3_PUBLIC_BASE_URL` задан.

**Объём:**

1. **`UploadIntentRepository` + `PrismaUploadIntentRepository`** (`src/lib/data/`):
   `createPending`, `findByKey`, `markFinalized(key, actualSize)`,
   `markAttached(key)`, `expireStale(limit)`. `key` unique; `PENDING → FINALIZED
   → ATTACHED`; `DELETING`/`EXPIRED` для cleanup.
2. **`/api/admin/storage/upload-url`** — после генерации ключа создаёт `UploadIntent`
   `PENDING`: `ownerId` из admin-session, `entityType="beat"`, `entityId=<beatId>`,
   `kind`, `visibility`, `expectedSize`, `contentType`, `expiresAt = now + 5m`.
   Presigned PUT уже реализован (M7.1); guard `requireAdminMutation` уже стоит (M6.1a).
3. **`/api/admin/storage/finalize`** — принимает только существующий `PENDING`
   с этим `key`; `HeadObject` → пишет `actualSize` + `finalizedAt` → `FINALIZED`;
   сверяет `contentType` и размер по `UPLOAD_RULES` (`src/lib/storage/upload-rules.ts`).
4. **Привязка к биту** — `POST /api/admin/beats/[id]/assets` (guard
   `requireAdminMutation`): body `{ kind, key }`. Проверяет `keyMatchesKind(key, kind)`,
   `UploadIntent` в `FINALIZED`, `entityId === beatId`, `ownerId === session.userId`.
   В одной транзакции: `beat.<coverKey|previewKey|masterKey|archiveKey> = key`,
   `UploadIntent → ATTACHED` (`attachedAt`). Старый ключ бита (если был) → `DELETING`.
5. **`BeatService.attachAsset(beatId, kind, key, actorRole)`** — эта логика.
   `beatCreateSchema` / `beatUpdateSchema` по-прежнему **не** принимают ключи
   (`.strict()`).
6. **Публикация (уточнение M2):** переход бита в `available` требует `coverKey` **и**
   `previewKey` → иначе 409 `MISSING_REQUIRED_ASSETS`; `masterKey` — обязателен для
   продажи (проверять на M5).
7. **Клиентский хелпер** `src/lib/storage/client-upload.ts` (browser):
   `uploadBeatAsset(beatId, kind, file)` → `POST /upload-url` → `PUT` по presigned
   URL с обязательными заголовками → `POST /finalize` → `POST /beats/[id]/assets`.
   Прогресс, отмена, таймаут. **Никаких S3-кредов на клиенте.**
8. **Admin Beat UI** (`admin-beat-crud-manager.tsx`): включить сейчас disabled
   file-поля; загрузка идёт по `beatId` после create; показывать
   `hasCover/hasPreview/hasMaster/hasArchive`; публичные URL cover/preview брать из
   ответа attach / `AdminBeat` (не строить на клиенте).
9. **Cleanup** просроченных `PENDING` / `DELETING` `UploadIntent` —
   оппортунистический sweep (как `AuthThrottle`), + удаление осиротевшего объекта
   в Contabo после смены `beat.<...>Key`.
10. **Тесты:** `UploadIntentRepository` (`*.db.test.ts`); `finalize` принимает
    только `PENDING`; `attach` проверяет `ownerId` / `entityId` / `keyMatchesKind`;
    `beatCreateSchema` отвергает ключи; публикация без cover/preview → 409;
    клиентский хелпер (mock fetch); `no-supabase` расширить на новый код.

**Гейты выхода M7.2b:** бит со всеми 4 файлами через Contabo на Preview-деплое;
публичный рендер обложки и плеера превью; приватные WAV/ZIP недоступны анонимно
(anon GET → 403), доступны только по presigned; `lint` + `build` + `test` зелёные;
отдельный commit M7.2b; `STORAGE_BACKEND` в проде переключается не раньше M10.
