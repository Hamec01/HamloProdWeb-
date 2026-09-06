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

## 4. Что нужно сделать владельцу в панели Contabo

> Всё это выполняется вручную в панели/через S3 API. Секреты не присылать в чат и
> не коммитить. `usc1` endpoint и path-style уже подтверждены существующим доступом.

### 4.1 Создать два bucket

```
hamloprod-public     — обложки, превью MP3, аватары, медиа постов
hamloprod-private    — WAV-мастера, ZIP, приватные треки, (позже) договоры
```

Регион/endpoint: `https://usc1.contabostorage.com` (US Central), path-style.
**Bucket `250gb` не использовать** — он под бэкапы других проектов.

### 4.2 Отдельный access key для сайта

Не переиспользовать ключ из `/home/deploy/.passwd-s3fs` (это ключ бэкапного бакета).
В панели Contabo Object Storage:

1. Object Storage → выбранный instance → **S3 Credentials / Access Keys**.
2. Создать **новую пару** Access Key / Secret Key, назначение — «hamloprod-web app».
3. Если Contabo позволяет ограничить ключ бакетами/действиями — ограничить его только
   `hamloprod-public` и `hamloprod-private` (S3 policy на ключ). Если нет — принять
   как есть и запланировать ротацию.
4. Secret показывается один раз — сохранить в менеджере паролей, затем внести в env
   (раздел 4.5). В Git/чат не отправлять.

### 4.3 Bucket policies

`hamloprod-public`:
- анонимный `s3:GetObject` — **разрешён** (публичное чтение объектов);
- `s3:PutObject` / `s3:DeleteObject` — **только** по credentials сервера (ключ из 4.2);
- листинг бакета анонимно — запрещён.

`hamloprod-private`:
- анонимного доступа нет вообще (ни GET, ни листинг);
- любое чтение — только через presigned URL, который сервер выдаёт после проверки прав;
- запись/удаление — только по credentials сервера.

Пример публичной read-политики для `hamloprod-public` (применить через S3 API,
`aws s3api put-bucket-policy` или аналог; на VPS CLI не установлен):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hamloprod-public/*"
    }
  ]
}
```

### 4.4 CORS

Нужен только для direct-to-S3 PUT из браузера. Применить на **оба** бакета
(или как минимум на тот, куда идёт загрузка из UI):

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

`http://localhost:3000` — только для локальной разработки; в проде можно убрать.
`*` в `AllowedOrigins` не использовать.

### 4.5 Env (Vercel Environment Variables + локальный `.env.local`)

Пустой шаблон — [.env.example](../.env.example). Заполнить:

```
S3_ENDPOINT=https://usc1.contabostorage.com
S3_REGION=usc1
S3_ACCESS_KEY=<из 4.2, server-only>
S3_SECRET_KEY=<из 4.2, server-only>
S3_BUCKET_PUBLIC=hamloprod-public
S3_BUCKET_PRIVATE=hamloprod-private
S3_PUBLIC_BASE_URL=            # пусто ⇒ ${S3_ENDPOINT}/hamloprod-public; задать, если Contabo даёт иной публичный/CDN base
S3_FORCE_PATH_STYLE=true
STORAGE_BACKEND=supabase       # НЕ переключать на contabo-s3 в M7.1
```

`S3_ACCESS_KEY` / `S3_SECRET_KEY` — **без** `NEXT_PUBLIC_`. Проверить, что публичный
base URL из панели совпадает с тем, что строит `config.ts` (иначе задать `S3_PUBLIC_BASE_URL` явно).

---

## 5. Live S3 smoke test — BLOCKED_BY_CREDENTIALS

### 5.1 Почему заблокирован

В окружении агента переменные `S3_*` не заданы, доступа к панели Contabo нет,
ключ из `/home/deploy/.passwd-s3fs` относится к чужому бэкапному бакету и не должен
использоваться. Secret в чате не запрашивается.

### 5.2 Точный сценарий после получения ключей

Запускать локально с заполненным `.env.local` (или на Vercel Preview). Модули
готовы; нужен только небольшой скрипт-обёртка `scripts/storage-smoke.mts`:

1. `getS3Config()` → создать `new ContaboS3Storage(config)`.
2. **public put**: `putObject({ visibility:"public", key:"__smoke/<uuid>.txt", body, contentType:"text/plain", contentLength })`.
3. **public GET**: `fetch(getPublicUrl({ visibility:"public", key }))` → ожидать `200` и тело.
4. **private put**: `putObject({ visibility:"private", key:"__smoke/<uuid>.bin", ... })`.
5. **anonymous private GET**: `fetch("https://usc1.contabostorage.com/hamloprod-private/__smoke/<uuid>.bin")`
   → ожидать `403`/`401` (НЕ 200).
6. **signed private GET**: `createSignedDownloadUrl({ visibility:"private", key }, { expiresInSeconds: 600 })`
   → `fetch(url)` → ожидать `200`.
7. **cleanup**: `deleteObject` для обоих ключей; повторный `deleteObject` → без ошибки (идемпотентность).
8. Проверить, что тестовых объектов не осталось (`headObject` → `null`).

Отдельно проверить **presigned PUT из браузера**: `POST /api/admin/storage/upload-url`
под admin-сессией → `PUT` файла по выданному URL из вкладки браузера → `POST /finalize`
→ ожидать `200` и корректный `storage` reference. Это подтвердит CORS (4.4).

---

## 6. Результаты проверок M7.1

| Проверка | Результат |
|---|---|
| `npm run lint` | 0 errors, 13 warnings (все — в существующих файлах; новые файлы чистые) |
| `npm run build` | ✓ Compiled successfully; маршруты `/api/admin/storage/upload-url` и `/api/admin/storage/finalize` собраны |
| `npm test` (новый storage-код) | 52 теста, 52 pass, 0 fail |
| Live S3 smoke | **BLOCKED_BY_CREDENTIALS** (раздел 5) |
| Переключение существующих форм | не выполнялось (по ТЗ); `STORAGE_BACKEND` остаётся `supabase` |
| Секреты в коде/Git/выводе | нет; `.env.example` — только пустые значения |

Покрытие тестами: выбор public/private bucket, генерация безопасных ключей,
MIME/extension/size валидация, запрет path traversal, запрет `getPublicUrl` для
private, отсутствующая/невалидная конфигурация, неавторизованный доступ к API,
подмена `key`/`kind` при `finalize`, TTL signed URL, идемпотентность delete.

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

## 9. ТЗ на M7.2 — подключение Admin Beat UI

Цель: перевести загрузку **файлов бита** (cover, preview, WAV, ZIP) в
`admin-beat-crud-manager.tsx` на direct-to-S3, оставив Supabase как fallback до M8.

Предусловия (проверить до старта):
- [ ] `hamloprod-public` и `hamloprod-private` созданы (4.1);
- [ ] отдельный access key заведён и лежит в env Vercel + `.env.local` (4.2, 4.5);
- [ ] bucket policies применены и проверены smoke-тестом (4.3, раздел 5);
- [ ] CORS применён и presigned PUT из браузера проходит (4.4);
- [ ] «anonymous private GET → 403» подтверждено.

Объём M7.2:

1. **Клиентский upload-хелпер** `src/lib/storage/client-upload.ts` (browser):
   `requestUploadUrl(kind, entityId, file)` → `PUT` файла по presigned URL с
   обязательными заголовками → `finalizeUpload(key, kind)` → вернуть storage reference.
   Прогресс загрузки, отмена, таймаут. Никаких S3-кредов на клиенте.
2. **Флаг ветвления** в форме бита: при `STORAGE_BACKEND==="contabo-s3"` (прокинуть
   через серверный проп, как `hasSupabase`) использовать новый хелпер; иначе — текущий
   Supabase-путь без изменений.
3. **entityId для бита:** при создании бита сначала `POST /api/admin/beats` (черновик,
   получить `id`), затем загрузка файлов по `beats/<id>/…`, затем `PUT` с путями.
   Либо: генерировать `beatId` на клиенте (UUID) и принимать его на сервере при create.
   Выбрать один вариант в M7.2 и фиксировать.
4. **Серверная валидация в `/api/admin/beats`:** принимать только storage reference,
   прошедший `finalize` (проверять формат ключа `keyMatchesKind`), не доверять
   произвольным `coverImagePath` / `wavFilePath` из формы, когда backend = contabo-s3.
5. **Публичные URL:** для cover/preview сохранять в БД `publicUrl` из `finalize`
   (не строить на клиенте). Для приватных WAV/ZIP хранить только ключ.
6. **Тесты:** клиентский хелпер (mock fetch), серверная проверка reference в
   `/api/admin/beats`, ветвление backend.
7. **Не входит в M7.2:** перенос существующих файлов (M8), выдача WAV/ZIP покупателю
   (M9), cleanup осиротевших объектов (отдельная задача), треки/релизы/посты (M8).

Гейты выхода M7.2: создание и редактирование бита с загрузкой всех четырёх файлов
через Contabo на Preview-деплое; публичный рендер обложки и плеера превью; приватные
WAV/ZIP недоступны анонимно; `lint` + `build` + `test` зелёные; отдельный commit M7.2;
`STORAGE_BACKEND` в проде всё ещё `supabase` (переключение — не раньше M10).
