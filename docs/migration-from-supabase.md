# Миграция HamloProd: M0

Статус: архитектурная подготовка. Ветка `migration/self-hosted-backend`.
Основание: `roadmap_v2.md`, раздел 20. Production backend, зависимости, env,
авторизация и платежи не переключаются. Новые файлы TypeScript содержат только
типы/интерфейсы и не импортируются существующим runtime.

## Границы и адаптеры

Page/API → service (валидация, проверка сессии/прав, DTO) → repository → adapter.
Девять контрактов лежат в `src/lib/data/repositories/`. Текущие типы каталога
переиспользуются как внутренние модели; пути private assets нельзя сериализовать
в публичные ответы. Пагинация обязательна, сервис ограничивает limit (1–100),
offset >= 0. Ошибки адаптера отклоняют Promise, отсутствие записи возвращает null.
Mock fallback существующего `src/services/content.ts` сохраняется только до
осознанного переноса; ошибки production PostgreSQL нельзя маскировать mock-данными.

План реализации, **не готовые адаптеры M0**:

| Контракт | Временный adapter | Целевой adapter | Этап |
|---|---|---|---|
| BeatRepository | SupabaseBeatRepository | PostgresBeatRepository | M2 |
| TrackRepository | SupabaseTrackRepository | PostgresTrackRepository | M3 |
| ArtistRepository | SupabaseArtistRepository | PostgresArtistRepository | M3 |
| PostRepository | SupabasePostRepository | PostgresPostRepository | M4 |
| CommentRepository | SupabaseCommentRepository | PostgresCommentRepository | M4 |
| FavoriteRepository | SupabaseFavoriteRepository | PostgresFavoriteRepository | M4 |
| OrderRepository | SupabaseOrderRepository | PostgresOrderRepository | M5 |
| UserRepository | SupabaseUserRepository | PostgresUserRepository | M6 |
| SessionRepository | Supabase Auth bridge | PostgresSessionRepository | M6 |
| ObjectStorage | SupabaseStorageAdapter | ContaboS3StorageAdapter | M7 |

Размещение: `src/lib/data/supabase/`, `src/lib/data/postgres/`,
`src/lib/db/client.ts`, `src/lib/storage/{supabase-storage,contabo-s3-storage}.ts`.
M0 не добавляет пустые реализации, runtime selector, Prisma или S3 SDK.
Supabase Auth bridge сохраняет provider-managed sessions: нельзя выдавать их
за собственные session rows или извлекать password hashes через обычный SDK.
User/Session контракты описывают целевой M6; auth bridge остаётся отдельной границей.

Дополнительные контракты потребуются при переносе releases, artist posts,
site settings, feedback/ratings, reactions, downloads, loyalty и contracts.
OrderRepository сейчас задаёт атомарные операции продажи; полную модель buyer
и rights form добавить из существующих validators до подключения в M5.

## Проект схемы PostgreSQL 16 (не применяемая миграция)

В M1 оформить Prisma schema и versioned SQL migrations. UUID существующих строк
сохраняются; время — timestamptz/UTC, даты релизов — date; object keys — text,
размеры файлов — bigint. Переносить все колонки из SQL inventory ниже, включая
более поздние ALTER TABLE, а не только публичные TypeScript DTO.

| Таблица/модель | Поля и ограничения целевой схемы |
|---|---|
| users / User | id UUID PK из auth.users; normalized email UNIQUE; password_hash nullable; email_verified_at; created_at/updated_at. NULL hash для OAuth/reset-required, никогда не пустой пароль |
| profiles / Profile | id PK/FK users; email (legacy); role nullable admin/editor/artist; artist_id FK artists SET NULL. Обычный пользователь без privileged profile сохраняет role null |
| sessions / Session | id UUID PK; user_id FK users CASCADE; token_hash UNIQUE; expires_at; revoked_at; created_at; индексы user_id и expires_at |
| beats / Beat | Все текущие поля; slug UNIQUE; case_number UNIQUE; status available/reserved/sold/private CHECK; prices >= 0; preview MIME/name/size; cover/preview/master/ZIP keys; reservation_order_id FK orders UNIQUE nullable; reservation_expires_at |
| tracks / Track | Все текущие поля, cover/MP3 keys, release_id FK releases SET NULL, track_number, is_demo; slug UNIQUE |
| artists / Artist | Все поля bio/photo/social links; slug UNIQUE; не терять track_title/beat_title |
| releases / Release | Все поля, artist_id FK artists SET NULL; slug UNIQUE; тип album/ep/mixtape; published/featured; feat_artist_names; tracks через tracks.release_id |
| posts / Post | Все текущие поля; slug UNIQUE; section/category, content, CTA, published/featured |
| artist_posts / ArtistPost | artist_id FK artists CASCADE; author_id FK users SET NULL; body, image/audio keys, published; индекс artist_id/created_at |
| comments / Comment | Сохранить entity/content_id/author_id/display_name/body/stars; CHECK stars 1–5; индекс entity/content_id/created_at; author FK users |
| content_comments / ContentComment | Сохранить отдельно от comments: content_type/content_id и исходные данные/автор; объединение только после анализа дубликатов |
| content_ratings / ContentRating | user_id FK users; content_type/content_id; rating CHECK по текущей миграции; UNIQUE(content_type, content_id, user_id) |
| beat_reactions / BeatReaction | beat_id/user_id FK; reaction CHECK по текущей миграции; UNIQUE(beat_id,user_id) |
| favorites / Favorite | id UUID PK; user_id FK users; track_id FK tracks после очистки orphan IDs; UNIQUE(user_id,track_id) |
| beat_downloads / BeatDownload, track_downloads / TrackDownload | Сохранить исходные ID, user/content IDs, timestamps; FK; индексы content/time и user/time |
| user_loyalty_points / UserLoyaltyPoints | user_id PK/FK users; points, timestamps; изменения баланса транзакционно |
| beat_purchases / BeatPurchase | Исходные ID, buyer/beat и points; nullable order_id FK orders; сверка старых покупок до новых ограничений |
| orders / Order | Все buyer/rights/price/provider поля и статусы (включая pending_free_checkout); FK beat RESTRICT, buyer SET NULL; expires_at/paid_at; idempotency_key UNIQUE; индекс buyer/time; UNIQUE(provider,payment_external_id) для непустых IDs |
| beat_sales / BeatSale (новая) | beat_id PK/FK beats; order_id UNIQUE FK orders; buyer_user_id FK users; sold_at. Единственная успешная эксклюзивная продажа на бит; refund автоматически не открывает повторную продажу |
| payment_events / PaymentEvent (новая) | id UUID PK; provider/event_id UNIQUE; order_id FK; status, received_at, processed_at; provider event ID либо стабильный dedup key по протоколу; не логировать PII/secrets |
| contracts / Contract | order_id UNIQUE FK orders; beat_id FK; buyer_email; неизменяемый html_snapshot; pdf_key private; issued_at; сохранить contract metadata в orders |
| site_settings / SiteSetting | key text PK; все текущие title/subtitle/archive поля |
| upload_intents / UploadIntent (M7) | id, owner_id, entity_type/id, visibility, generated key UNIQUE, MIME, size, state pending/attached/deleting, expires_at; индекс state/expiry для cleanup |

Полиморфные comments/ratings не получают обычный FK на content_id: сервис проверяет
тип и существование сущности; удаление контента очищает связанные записи
транзакционно. До добавления FK favorites проверить orphan track IDs.
Не конвертировать автоматически legacy price_usd в minor units: текущий код
копирует RUB в legacy USD columns. Сверить base_price/final_price/currency,
историю invoice и округление, затем задокументировать единицы денег.
Исторический license_type basic сохраняется как legacy metadata; новые сделки
после M5 исключительно exclusive, без тарифов lease/basic/premium.

### Транзакции продажи

1. Reserve: lock beat FOR UPDATE, проверить available, записать order и владельца
   reservation в одной транзакции; повтор idempotency_key возвращает тот же order.
2. Внешний вызов payment provider вне транзакции с idempotency/reconciliation;
   attachPayment не меняет принадлежность резерва.
3. Проверенный webhook: dedup event, lock order + beat, сверить external ID,
   сумму/валюту и владельца резерва; записать beat_sales, paid, sold,
   entitlement/loyalty и processed event атомарно. Повтор — no-op.
4. Expiry job берёт ограниченную пачку с блокировками; освобождает только свой
   неоплаченный истёкший резерв. Конкурирующий webhook не должен потерять продажу.
5. Поздний paid после освобождения/перепродажи — conflict с ручной/provider
   reconciliation и refund; нельзя отдавать мастер второму покупателю.

Не применять UNIQUE(beat_id) на все orders: это запретит повторные попытки checkout.
Проверки гонок и retry — обязательный integration gate M5.

## Авторизация и доступ

RLS/auth.uid()/is_admin_user() не работают автоматически через Prisma.
Сервисы обязаны проверять пользователя и роль из серверной сессии, владение
заказом/комментарием/favorites и profile.artist_id для artist posts.
Admin/editor сохраняют управление контентом, artist — своим контентом.
Supabase service-role сейчас используется в Lava webhook; заменить серверной
транзакцией, не общедоступным update API. Публичные DTO исключают secrets,
password hash, token hash, buyer PII и private asset paths.

M6: Argon2id; случайный session token, в DB только hash; httpOnly/Secure production/
SameSite=Lax cookie; expiry, атомарная rotation, revoke/logout; origin/CSRF checks
для mutation routes, rate limits login/reset. Сохранить UUID пользователей до M2–M5:
при временном Supabase login сервер верифицирует user и сопоставляет его с users
в PostgreSQL. Импортировать всех auth.users, а не только privileged profiles.
Google OAuth сейчас есть: нужен отдельный migration path OAuth identities или
явный reset/relogin flow; Argon2 не импортирует чужой hash как новый пароль.
Проверка доступа email confirmation и recovery также входит в gate M6.

## Storage

ObjectStorage контракт: `src/lib/storage/object-storage.ts`. Адаптеры server-only;
getPublicUrl допускает только public, проверяя visibility также runtime.
Private signed URL выдаётся после entitlement check на 300–900 секунд.

| Старый bucket | Цель | Ключ |
|---|---|---|
| media-images | hamloprod-public | beats/tracks/releases/artists/<uuid>/<generated-id>.<ext> |
| beat-previews | hamloprod-public | beats/<uuid>/previews/<generated-id>.mp3 |
| post-files | hamloprod-public | posts/artist-posts/<uuid>/<generated-id>.<ext> |
| beat-downloads | hamloprod-private | beats/<uuid>/master-or-stems/<generated-id>.<ext> |
| track-downloads | hamloprod-private | tracks/<uuid>/<generated-id>.mp3 |
| contracts-pdf | hamloprod-private | contracts/<order-uuid>/<generated-id>.pdf |

Уникальный ключ на каждую загрузку позволяет заменить DB reference перед cleanup
старого объекта. Проверять MIME/signature, extension, размер, entity и права на
сервере. Browser upload требует server-authorized presign + finalization validation
в M7 (отдельный upload protocol), иначе большие WAV нельзя проксировать через
обычный Vercel request. Interface putObject предназначен для серверных операций.
Настроить CORS только hamloprod.org/www, localhost по необходимости; public GET
только public bucket; PUT/DELETE server credentials; private без public policy.
Copy inventory old bucket/key → new bucket/key, сверка bytes/checksum (не считать
multipart ETag SHA), проверка GET/range/audio; DB ссылки менять после проверки.
Очистка abandoned uploads с TTL; удаление старых объектов только после сохранения
новой ссылки и проверки отсутствия других references. Retention rollback копий.

Будущие env (M1/M7, **не установлены M0**): DATABASE_URL, SESSION_SECRET,
S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PUBLIC,
S3_BUCKET_PRIVATE, S3_PUBLIC_BASE_URL, S3_FORCE_PATH_STYLE.
DATA_BACKEND=supabase|postgres, STORAGE_BACKEND=supabase|contabo-s3; default supabase.
Не добавлять NEXT_PUBLIC_ secrets. Сохранить старые Supabase env до M11.

## Порядок и cutover

M1 infrastructure/schema → M2 beats → M3 tracks/artists/**releases** →
M4 posts/artist posts/оба набора comments/ratings/reactions/favorites/site settings →
M5 orders/payments/contracts metadata/loyalty/download logs → M6 auth →
M7 storage foundation → M8 public media → M9 private → M10 cutover → M11 removal.

Один глобальный DATA_BACKEND нельзя включать в production в середине переноса
сущностей. До M10 adapter выбор тестируется в isolated staging с полной копией
нужных FK; production Supabase остаётся источником истины. Поэтапно переносится
код, а не несогласованные production записи. Неперенесённые repositories остаются
Supabase в staging composition. Пользовательские UUID bridge сохраняет связи.

M10: сначала restore rehearsal; временно остановить записи/checkout, дождаться
или сверить in-flight payments; финальный data/file delta с manifest/checksums;
сверить counts, FK, деньги, роли, paid entitlements; переключить env и redeploy;
smoke admin CRUD/upload, public lists/player, login/logout, покупка/webhook,
private denied/signed allowed. До возобновления writes возможен rollback env.
После новых writes на PostgreSQL rollback требует reverse delta и сверки payments,
простое переключение назад недопустимо. Supabase удалить только после согласованного
стабильного периода, подтверждённых backup/restore и отсутствия runtime imports.

## Риски, обнаруженные в исходниках

- checkout проверяет sold/private, но не создаёт атомарную reservation; webhook
  меняет orders и beats отдельными запросами. Текущая retry-логика не доказывает
  защиту от конкурентной двойной продажи. M0 её не меняет.
- contracts-pdf SQL policy разрешает select/insert всем authenticated без owner
  ограничения. Private bucket сам по себе не гарантирует персональные права.
  В M9 проверять владельца заказа перед signing; не переносить широкую policy.
- Orders имеют legacy license_type basic и несколько price/provider полей.
  Исторические договоры/покупки требуют сверки с моделью «1 beat = 1 buyer».
- Два набора комментариев; releases/artist links и favorites отсутствуют в части
  первоначального roadmap; нельзя мигрировать лишь девять основных таблиц.
- Browser напрямую загружает файлы через Supabase. S3 credentials туда переносить
  нельзя; понадобятся upload authorization/finalization и cleanup.
- SQL файлы отражают repo, не доказанное состояние live DB. До M1 снять schema-only
  export и проверить применённые миграции/RLS/constraints без вывода секретов.
- Fallback mock data может скрыть отсутствие env. Green build не заменяет live smoke.

## Точный следующий этап M1

1. Инвентаризировать VPS/сеть, действующие сервисы и доступ; не ставить поверх
   неизвестной DB. Выделить staging DB и dedicated least-privilege app role,
   отдельно migration owner. PostgreSQL 16; закрыть публичный 5432, выбрать
   контролируемый путь Vercel → DB (ограниченный egress/private network/tunnel).
2. Настроить проверяемый TLS с CA/hostname, без отключения certificate validation;
   согласовать pool budget по Vercel concurrency, при необходимости PgBouncer
   transaction pool и отдельный direct URL для migrations.
3. Добавить закреплённые совместимые Prisma packages, schema, generated client
   и `src/lib/db/client.ts` с reuse pool. Перенести все таблицы из inventory,
   убрать Supabase auth/storage schema dependencies, сохранить UUID/FK.
   Новые SQL checks/indexes добавлять после очистки конфликтующих legacy данных.
4. Подготовить повторяемый экспорт/импорт с mapping/counts/checksums и dry run;
   создать users identity bridge до импорта зависимых rows; password migration
   оставить отдельному M6. Никаких production migrations на этом шаге.
5. Добавить server-side DATA_BACKEND config default supabase, fail closed при
   неверном значении; PostgreSQL factory подключать по готовности adapters.
   Production env не переключать.
6. Настроить daily pg_dump в независимое защищённое хранилище: 7 daily,
   4 weekly, 3 monthly; мониторить failures; проверить restore в чистую DB.
   Private media — дополнительная независимая копия, не только тот же Contabo.
7. Проверить clean migration/restore, TLS из Vercel preview, connection budget,
   ограничения и FK, отсутствие browser credentials, lint/build. Отдельный
   M1 commit; результат — infrastructure foundation, не production cutover.

## Проверки M0

Результаты lint/build записаны ниже после запуска. Live Supabase/VPS/Contabo и
production smoke не выполняются в M0. Roadmap пользователя остаётся вне коммита.

## Полный source inventory

Категории пересекаются. Все source-файлы с упоминанием Supabase, включая UI/env
guards, и storage constants. В M0 все зависимости сохраняются.

| Файл | Категории | Замена |
|---|---|---|
| `src/app/(public)/auth/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/(public)/checkout/[slug]/page.tsx` | database, other | repositories: user_loyalty_points (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/(public)/checkout/payment/[orderId]/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/(public)/checkout/preview/[orderId]/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/(public)/checkout/rights/[orderId]/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/(public)/profile/page.tsx` | database, other | repositories: beats, content_ratings, orders, user_loyalty_points (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/[locale]/artists/[slug]/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/[locale]/artists/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/[locale]/vst/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/artists/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/beats/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/dashboard/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/login/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/posts/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/releases/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/admin/tracks/page.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/artists/[id]/route.ts` | database, other | repositories: artists (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/artists/route.ts` | database, other | repositories: artists (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/beats/[id]/route.ts` | database, other | repositories: beats (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/beats/[id]/telegram/route.ts` | database, other | repositories: beats (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/beats/route.ts` | database, other | repositories: beats (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/posts/[id]/route.ts` | database, other | repositories: posts (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/posts/route.ts` | database, other | repositories: posts (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/releases/[id]/route.ts` | database, other | repositories: releases, tracks (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/releases/route.ts` | database, other | repositories: releases, tracks (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/tracks/[id]/route.ts` | database, other | repositories: tracks (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/admin/tracks/route.ts` | database, other | repositories: tracks (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/artist-posts/[id]/route.ts` | database, other | repositories: artist_posts (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/artist-posts/route.ts` | database, storage, other | repositories: artist_posts, profiles (M2–M5); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/app/api/beats/[id]/download/route.ts` | auth, database, storage, other | AuthService / UserRepository / SessionRepository (M6); repositories: beat_downloads, beats (M2–M5); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/app/api/beats/[id]/purchase/route.ts` | auth, database, other | AuthService / UserRepository / SessionRepository (M6); repositories: beat_purchases, beats, user_loyalty_points (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/beats/[id]/reaction/route.ts` | auth, database, other | AuthService / UserRepository / SessionRepository (M6); repositories: beat_reactions (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/checkout/route.ts` | database, other | repositories: beats, orders, user_loyalty_points (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/comments/[id]/route.ts` | database, other | repositories: comments (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/comments/route.ts` | database, other | repositories: comments (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/contracts/pdf/route.ts` | other | backend-neutral config/UI (M1–M11) |
| `src/app/api/contracts/preview/route.ts` | other | backend-neutral config/UI (M1–M11) |
| `src/app/api/favorites/route.ts` | database, other | repositories: favorites (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/feedback/[entity]/[id]/route.ts` | auth, database, other | AuthService / UserRepository / SessionRepository (M6); repositories: content_comments, content_ratings (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/lava/webhook/route.ts` | database, service-role | repositories: beats, orders (M2–M5); verified payment transaction (M5) |
| `src/app/api/loyalty/status/route.ts` | auth, database, other | AuthService / UserRepository / SessionRepository (M6); repositories: user_loyalty_points (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/app/api/payments/create/route.ts` | other | backend-neutral config/UI (M1–M11) |
| `src/app/api/tracks/[id]/download/route.ts` | auth, database, storage, other | AuthService / UserRepository / SessionRepository (M6); repositories: track_downloads, tracks (M2–M5); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/app/api/tracks/[id]/stream/route.ts` | database, storage, service-role, other | repositories: tracks (M2–M5); ObjectStorage / upload service (M7–M9); verified payment transaction (M5); backend-neutral config/UI (M1–M11) |
| `src/app/auth/callback/route.ts` | auth | AuthService / UserRepository / SessionRepository (M6) |
| `src/components/admin/admin-artist-crud-manager.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/components/admin/admin-beat-crud-manager.tsx` | auth, storage, other | AuthService / UserRepository / SessionRepository (M6); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/components/admin/admin-login-form.tsx` | auth, other | AuthService / UserRepository / SessionRepository (M6); backend-neutral config/UI (M1–M11) |
| `src/components/admin/admin-post-crud-manager.tsx` | auth, storage, other | AuthService / UserRepository / SessionRepository (M6); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/components/admin/admin-release-crud-manager.tsx` | auth, storage, other | AuthService / UserRepository / SessionRepository (M6); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/components/admin/admin-track-crud-manager.tsx` | auth, storage, other | AuthService / UserRepository / SessionRepository (M6); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/components/artists/artist-inline-admin-panel.tsx` | other | backend-neutral config/UI (M1–M11) |
| `src/components/auth/public-auth-form.tsx` | auth, other | AuthService / UserRepository / SessionRepository (M6); backend-neutral config/UI (M1–M11) |
| `src/components/auth/public-auth-status.tsx` | auth | AuthService / UserRepository / SessionRepository (M6) |
| `src/lib/auth/session.ts` | auth, database, other | AuthService / UserRepository / SessionRepository (M6); repositories: profiles (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/lib/contracts/pdf.ts` | database, storage, other | repositories: beats, contracts, orders (M2–M5); ObjectStorage / upload service (M7–M9); backend-neutral config/UI (M1–M11) |
| `src/lib/contracts/preview.ts` | database, other | repositories: beats, contracts, orders (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/lib/i18n.ts` | other | backend-neutral config/UI (M1–M11) |
| `src/lib/payments/create.ts` | database, other | repositories: beats, contracts, orders (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/lib/storage/media.ts` | storage | ObjectStorage / upload service (M7–M9) |
| `src/lib/supabase/admin.ts` | service-role, other | verified payment transaction (M5); backend-neutral config/UI (M1–M11) |
| `src/lib/supabase/browser.ts` | auth, other | AuthService / UserRepository / SessionRepository (M6); backend-neutral config/UI (M1–M11) |
| `src/lib/supabase/env.ts` | other | backend-neutral config/UI (M1–M11) |
| `src/lib/supabase/server.ts` | auth, other | AuthService / UserRepository / SessionRepository (M6); backend-neutral config/UI (M1–M11) |
| `src/proxy.ts` | auth | AuthService / UserRepository / SessionRepository (M6) |
| `src/services/content.ts` | database, other | repositories: artist_posts, artists, beats, comments, posts, releases, site_settings, track_downloads, tracks (M2–M5); backend-neutral config/UI (M1–M11) |
| `src/services/mock-data.ts` | other | backend-neutral config/UI (M1–M11) |

### Оставшиеся прямые imports

50 файлов, 84 import declarations:

- `src/app/(public)/checkout/[slug]/page.tsx`: 11, 12
- `src/app/(public)/checkout/payment/[orderId]/page.tsx`: 11
- `src/app/(public)/checkout/preview/[orderId]/page.tsx`: 14
- `src/app/(public)/checkout/rights/[orderId]/page.tsx`: 9
- `src/app/(public)/profile/page.tsx`: 9, 10
- `src/app/api/admin/artists/[id]/route.ts`: 4, 5
- `src/app/api/admin/artists/route.ts`: 4, 5
- `src/app/api/admin/beats/[id]/route.ts`: 4, 5
- `src/app/api/admin/beats/[id]/telegram/route.ts`: 4, 5
- `src/app/api/admin/beats/route.ts`: 4, 5
- `src/app/api/admin/posts/[id]/route.ts`: 4, 5
- `src/app/api/admin/posts/route.ts`: 4, 5
- `src/app/api/admin/releases/[id]/route.ts`: 4, 5
- `src/app/api/admin/releases/route.ts`: 4, 5
- `src/app/api/admin/tracks/[id]/route.ts`: 4, 5
- `src/app/api/admin/tracks/route.ts`: 4, 5
- `src/app/api/artist-posts/[id]/route.ts`: 3, 4
- `src/app/api/artist-posts/route.ts`: 5, 6
- `src/app/api/beats/[id]/download/route.ts`: 2, 3
- `src/app/api/beats/[id]/purchase/route.ts`: 2, 3
- `src/app/api/beats/[id]/reaction/route.ts`: 2, 3
- `src/app/api/checkout/route.ts`: 3, 6
- `src/app/api/comments/[id]/route.ts`: 3, 4
- `src/app/api/comments/route.ts`: 4, 5
- `src/app/api/contracts/pdf/route.ts`: 2
- `src/app/api/contracts/preview/route.ts`: 3
- `src/app/api/favorites/route.ts`: 3, 4
- `src/app/api/feedback/[entity]/[id]/route.ts`: 2, 3
- `src/app/api/lava/webhook/route.ts`: 7
- `src/app/api/loyalty/status/route.ts`: 2, 3
- `src/app/api/payments/create/route.ts`: 4
- `src/app/api/tracks/[id]/download/route.ts`: 2, 3
- `src/app/api/tracks/[id]/stream/route.ts`: 2, 3
- `src/app/auth/callback/route.ts`: 2
- `src/components/admin/admin-beat-crud-manager.tsx`: 11
- `src/components/admin/admin-login-form.tsx`: 8
- `src/components/admin/admin-post-crud-manager.tsx`: 10
- `src/components/admin/admin-release-crud-manager.tsx`: 9
- `src/components/admin/admin-track-crud-manager.tsx`: 9
- `src/components/auth/public-auth-form.tsx`: 6
- `src/components/auth/public-auth-status.tsx`: 5
- `src/lib/auth/session.ts`: 3, 4
- `src/lib/contracts/pdf.ts`: 6, 7
- `src/lib/contracts/preview.ts`: 5, 6
- `src/lib/payments/create.ts`: 4, 5
- `src/lib/supabase/admin.ts`: 1, 2
- `src/lib/supabase/browser.ts`: 1, 2
- `src/lib/supabase/server.ts`: 2, 3
- `src/proxy.ts`: 2
- `src/services/content.ts`: 1, 2

### SQL и package inventory

`package.json` и `package-lock.json`: @supabase/ssr и @supabase/supabase-js
сохраняются до M11. README.md: старые Supabase-ready инструкции заменить после
cutover. roadmap_v2.md: целевой план. Все SQL migrations перечислены ниже;
public DDL → Prisma/SQL, auth.users/uid и RLS → users + server authorization,
storage policies → Contabo bucket policies + signing service.

| Миграция | Сущности | Зависимости |
|---|---|---|
| `supabase/migrations/20260408_init_hamloprod.sql` | artists, beats, is_admin_user, profiles, set_updated_at, site_settings, tracks | database, auth/RLS |
| `supabase/migrations/202604100101_add_beat_storage_assets.sql` | beats, is_admin_user | database, storage |
| `supabase/migrations/202604100102_add_public_media_and_track_downloads.sql` | beats, is_admin_user, track_downloads, tracks | database, auth/RLS, storage |
| `supabase/migrations/20260411_add_beat_download_logs.sql` | beat_downloads, beats, is_admin_user | database, auth/RLS |
| `supabase/migrations/202604120101_add_available_for_download_flag.sql` | beats | database |
| `supabase/migrations/202604120102_add_content_feedback.sql` | content_comments, content_ratings, set_updated_at | database, auth/RLS |
| `supabase/migrations/202604130101_add_beat_reactions.sql` | beat_reactions, beats, set_updated_at | database, auth/RLS |
| `supabase/migrations/202604130102_add_user_loyalty_points.sql` | beat_purchases, beats, set_updated_at, user_loyalty_points | database, auth/RLS |
| `supabase/migrations/202604140101_add_purchase_flow.sql` | beat_purchases, beats, contracts, is_admin_user, orders, set_updated_at | database, auth/RLS |
| `supabase/migrations/202604140102_add_order_buyer_details.sql` | orders | database |
| `supabase/migrations/202604150101_add_pending_free_checkout_status.sql` | orders | database |
| `supabase/migrations/202604150102_add_price_rub_to_beats.sql` | beats | database |
| `supabase/migrations/202604150103_allow_user_contract_drafts.sql` | contracts, is_admin_user, orders | database, auth/RLS |
| `supabase/migrations/202604160101_add_lava_rights_form_and_contract_pdf.sql` | is_admin_user, orders | database, storage |
| `supabase/migrations/202604160102_add_order_payment_url.sql` | orders | database |
| `supabase/migrations/202604160103_ensure_beat_price_columns.sql` | beats | database |
| `supabase/migrations/202604160104_add_order_price_snapshot_columns.sql` | orders | database |
| `supabase/migrations/202604190101_hide_sold_beats_from_public.sql` | beats, orders | database |
| `supabase/migrations/202604200101_add_posts_for_admin_and_vst.sql` | is_admin_user, posts, set_updated_at | database |
| `supabase/migrations/202604200102_add_post_files_bucket.sql` | is_admin_user | database, storage |
| `supabase/migrations/202604220101_add_releases.sql` | is_admin_user, releases, set_updated_at, tracks | database |
| `supabase/migrations/202604230101_artist_page_system.sql` | artist_posts, artists, comments, is_admin_user, profiles, releases, set_updated_at | database, auth/RLS |
| `supabase/migrations/202604230102_add_feat_artist_names.sql` | bucket policies | database |
| `supabase/migrations/20260424_add_favorites_table.sql` | favorites | database, auth/RLS |
| `supabase/migrations/202604250101_add_is_demo_to_tracks.sql` | bucket policies | database |
| `supabase/migrations/202604260101_add_beat_genre_substyle.sql` | beats | database |
| `supabase/migrations/202604260102_add_beat_preview_metadata.sql` | beats | database, storage |

### Карта database entities → contract

| Query table | Целевая граница |
|---|---|
| beats | BeatRepository; продажа только через OrderRepository transaction |
| tracks | TrackRepository |
| artists | ArtistRepository |
| profiles, auth.users | UserRepository / AuthService |
| orders, beat_purchases, user_loyalty_points | OrderRepository + LoyaltyRepository (добавить M5) |
| contracts | ContractRepository (добавить M5), ObjectStorage для PDF |
| comments | CommentRepository |
| favorites | FavoriteRepository |
| posts | PostRepository |
| releases | ReleaseRepository (добавить M3) |
| artist_posts | ArtistPostRepository (добавить M4) |
| content_comments, content_ratings | FeedbackRepository (добавить M4) |
| beat_reactions | ReactionRepository (добавить M4) |
| beat_downloads, track_downloads | DownloadRepository (добавить M5), DownloadService проверяет доступ |
| site_settings | SiteSettingsRepository (добавить M4) |

`src/proxy.ts` refresh cookies и `src/app/auth/callback/route.ts` exchangeCodeForSession
заменяются проверкой собственных sessions и отдельным auth callback в M6.
`src/lib/supabase/server.ts` — request-scoped temporary adapter client;
`browser.ts` удаляется после переноса auth/uploads на server endpoints;
`admin.ts` — только verified webhook transaction; `env.ts` — server config.

### Итог проверки M0

- `npm ci`: успешно, lockfile не изменён. Установщик сообщил 15 dependency
  vulnerabilities (1 low, 1 moderate, 13 high); зависимости не обновлялись в M0.
- `npm run lint`: exit 0; 0 errors, 13 warnings в существующих файлах;
  новые интерфейсы без предупреждений.
- `npm run build`: exit 0; Next.js 16.2.2/Turbopack, compilation, TypeScript
  и генерация маршрутов завершены успешно. Новые production env не требуются.
- Прямые Supabase imports: 84 в 50 файлах, намеренно сохранены.
- Изменения: этот документ, `src/lib/data/repositories/common.ts`, девять
  `*.repository.ts`, `src/lib/storage/object-storage.ts` (12 новых файлов).
- Runtime исходники, package/lockfile, production env и deployment не изменены.
  Тесты с live DB/storage/payment provider в M0 не запускались.
