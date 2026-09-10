# Legacy restore — accounts, orders, contracts, social + runtime off Supabase

Статус: **runtime полностью на PostgreSQL/Contabo; Preview E2E — в процессе.**
Ветка `migration/self-hosted-backend`. ТЗ: `docs/claude-handoff-legacy-restore.md`.
Основание: `roadmap_v2.md` §16 (M2–M6, M11), `docs/postgres-foundation.md`,
`docs/storage-migration.md`, `docs/preview-db-connection.md`.

Продолжение после `9fc8b2b` (beats/releases/tracks/posts + storage). Здесь —
оставшиеся сущности и **удаление Supabase из runtime**.

---

## 1. Перенос данных (M5.1 — commit `5e5c854`)

Изолированная восстановленная БД `hamloprod-supabase-import-db` (`--network none`)
→ JSON-экспорт (`json_agg`, mode 600) → `scripts/import-legacy-accounts.mts`
(`--dry-run` / `--apply`, idempotence-guard, FK/enum/range/unique-валидация,
stdout только counts — без email/hash/passport/token/тела договора).

| Таблица | Source | Target | Заметки |
|---|---|---|---|
| `auth.users` → `users` | 4 | 4 | 3 bcrypt-identity, 1 Google-only (`passwordHash = null`), admin-роль из legacy `profiles` |
| `orders` | 3 | 3 | text status/currency/market/provider/license + CHECK-констрейнты (не enum) |
| `contracts` | 3 | 3 | `html_snapshot` сохранён; `pdf_path` → `pdfKey = null` (объектов нет) |
| `beat_purchases` | 9 | 9 | `discount_percent ∈ {0,50,100}` |
| `beat_reactions` | 3 | 3 | unique `(beat_id, user_id)` |
| `content_comments` | 1 | 1 | polymorphic `content_id` (beat/track), без FK |
| `content_ratings` | 1 | 1 | 1–5, unique `(type, id, user)` |
| `user_loyalty_points` | 2 | 2 | сумма = Σ `points_earned` покупок (9) |
| `beat_downloads` / `track_downloads` | 0 / 0 | — | таблицы созданы для runtime-логов |

Prisma-модели: `Order`, `Contract`, `BeatPurchase`, `BeatReaction`,
`ContentComment`, `ContentRating`, `LoyaltyPoint`, `BeatDownloadLog`,
`TrackDownloadLog` + `User.lastSignInAt`. Миграция
`20260910151354_m5_accounts_orders_social`. 0 FK-сирот после apply.

**Пустые в legacy, таблиц не было в Supabase** — модели добавлены под runtime,
данных нет: `Comment` (release/artist-post комментарии), `Favorite` (избранные
треки), `ArtistPost` (миграции `20260910153056`, `20260910155554`).
`artists` — 0 строк.

---

## 2. Собственная покупательская авторизация (M6.2 — commit `a35a331`)

`Session.scope` (`'admin' | 'public'`, CHECK) — токен одной поверхности не
принимается валидатором другой. Cookie `hp_session` / `__Host-hp_session`, TTL
30 дней, в БД только `HMAC-SHA256(SESSION_SECRET, token)`.

- `src/lib/auth/public-session-store.ts` — create / validate / revoke.
- `src/lib/auth/public-auth-service.ts` (порты, тестируется без `next/*`) —
  signup / login / logout. Origin allow-list → two-scope throttle → одинаковый
  401 для «неизвестный email / неверный пароль / нет пароля», настоящая
  dummy-hash проверка. **signup для существующего email = попытка входа** (не
  раскрывает наличие аккаунта).
- `src/lib/auth/password.ts` — `verifyPasswordAnyFormat()` принимает и Argon2id,
  и legacy Supabase bcrypt (`$2a$/$2b$/$2y$`, `bcryptjs`, cap 72 байта). Успешная
  проверка bcrypt → **немедленный re-hash в Argon2id** и запись. Buyer policy
  min 8 (`hashBuyerPassword`).
- Роуты `POST /api/auth/{login,signup,logout}`, `GET /api/auth/me` — `nodejs`,
  `Cache-Control: no-store`.
- **Google OAuth убран** (кнопка + `/auth/callback`). Форма честно сообщает, что
  вход через Google временно недоступен; единственному Google-only аккаунту
  доступ восстанавливается вручную (`scripts/create-admin.ts`-подобно, или
  задать пароль в БД).

Локальный E2E против реальной БД: 9/9 (signup, изоляция scope, wrong/right
password, bcrypt→Argon2id с записью, идентичный ответ на неизвестный email).

---

## 3. Runtime off Supabase

| Область | Commit | Что |
|---|---|---|
| Реакции / рейтинги / комментарии / лояльность / покупки / favorites / download-логи + `/api/feedback` | `3647b4f` (M6.2b) | `requireBuyer` guard (origin + buyer session). HTTP E2E пройден. |
| Checkout / orders / payments / lava webhook / contracts (preview+pdf) / profile | `54f4874` (M5.2) | `src/lib/orders/order-row.ts` — адаптер Prisma → snake_case. Contract PDF → **приватный** ключ `contracts/<orderId>/…`, скачивание только 1h signed GET. Webhook: paid ⇒ `order.paidAt` + `beat.status='sold'` в одной транзакции. Локальный DB E2E 7/7. |
| Artists / artist-posts / admin CRUD (tracks, releases, posts, artists) / `content.ts` / telegram | `46167bc` (M3.2/M4.2), `8a0a98a` | `content.ts` без `withSupabaseFallback` и mock-fallback. Generic admin upload: `/api/admin/storage/asset-url` + `asset-confirm` + `uploadAdminAsset()` (admin-trusted, без UploadIntent — он остаётся только для битов). Admin HTTP E2E пройден. |
| Удаление зависимости | `8a0a98a` | `src/lib/supabase/` удалён; `@supabase/ssr`, `@supabase/supabase-js` убраны; `DATA_BACKEND`/`STORAGE_BACKEND` больше не принимают `"supabase"`; `.env.example` без Supabase-блока. Тест `src/lib/no-supabase-runtime.test.ts` (`git grep`, package.json, каталог). |

`rg` подтверждает: **0 импортов Supabase в runtime-коде** (`src/**` минус тесты).
Остаются только: комментарии, regex перезаписи старых Supabase-URL в теле постов
на Contabo-ключи, префикс ключей `legacy-supabase/`, и упоминания в
migration-скриптах/доках как источника архива.

### Известные ограничения

- Загрузка MP3 по трекам из **release-менеджера** отложена (грузить через
  track-менеджер). Обложка релиза — грузится.
- Осиротевшие admin-asset ключи (перезаписанная обложка трека/поста) не
  подметаются — полный media-reconcile в M8/M9.
- Vercel Preview env всё ещё содержит неиспользуемые `NEXT_PUBLIC_SUPABASE_*`
  (multi-target с production — не трогаем).

---

## 4. Проверки

| | Результат |
|---|---|
| `npm test` | 184/184 |
| `npm run lint` | 0 errors, 9 warnings (в ранее существовавших файлах) |
| `npm run build` | ✓ |
| `npx prisma migrate status` | up to date, 9 миграций |
| `npx tsx scripts/storage-smoke.mts` | **5/5** (владелец применил public bucket policy) |
| DB app-роль на новых таблицах | SELECT/INSERT/UPDATE/DELETE — все `t` |
| Локальные HTTP/DB E2E | auth 9/9, social (полный цикл), checkout 7/7, admin CRUD (track/post/artist/release + asset presign) |

---

## 5. Preview E2E — статус

**Deployment:** проект `hamlo-prod-web` (`prj_8eTSyXYn7QA26RUsgZFteZgokZrL`),
`dpl_715gbNQ6x41pBu5rSGDiJq3LByXP`, commit `8a0a98a`, **READY**, alias
`hamlo-prod-web-git-migration-sel-bf2e3e-inkeritm-4372s-projects.vercel.app`.
Build: `prisma generate` ок (client v6.19.3), `next build` ✓, все роуты `ƒ`
(dynamic). `db.hamloprod.org:6432` (PgBouncer) — **открыт и отвечает**;
`hamloprod_app` имеет DML на всех новых таблицах.

**Браузерный E2E не выполнен из этой сессии:** Preview под Vercel SSO
(`ssoProtection: all_except_custom_domains`), Protection-Bypass secret не заведён,
Vercel MCP (`web_fetch_vercel_url`) в сессии недоступен. Нужен доступ владельца
(share-link, временное снятие SSO, или прогон вручную).

### Чеклист для владельца (Preview)

1. Главная, `/en/beats`, `/en/ham`, `/en/tracks/<release>`, `/en/vst` + все
   изображения и `.exe` из VST-поста.
2. Реальное воспроизведение preview бита и трека (Range → 206).
3. `POST /api/auth/signup` новым email → 201 + cookie `__Host-hp_session`;
   `/api/auth/me` → authenticated; logout; повторный login.
4. Вход legacy-пользователя (email из архива, известный старый пароль) → 200;
   в БД `password_hash` этого пользователя стал `$argon2id$…` (проверить
   `select left(password_hash,10) from users where email=…`). Hash не в ответе.
5. `/admin/login` (админ из архива, старый пароль) → 200; `/admin/tracks`
   создать/переименовать/удалить трек; то же для release, post, artist.
6. `/admin/beats` → создать private-бит.
7. Загрузка cover/preview/WAV/ZIP: upload-url → PUT → finalize → attach; все 4
   ключа на бите, intents `ATTACHED`.
8. Публикация бита → `/en/beats/<slug>` показывает публичную обложку, preview
   играет.
9. WAV и ZIP: анонимный GET по ключу → **403/401**; `/api/beats/<id>/download`
   (или signed GET) → 200, байты совпадают.
10. Профиль: история заказов + рейтингов; лояльность; поставить реакцию /
    комментарий / рейтинг / favorite и увидеть их.
11. Conditional PUT replay → 412; замена обложки → старый ключ в `DELETING`.
12. В HTML нет private object-ключей, credentials, database URL.

Затем Vercel **Runtime Logs** deployment'а: без Prisma init errors, connection
timeouts, 500.

> Если mutation-роуты отвечают **403 Forbidden** — проверить, что Preview
> `AUTH_EXTRA_ORIGINS` = точный origin
> `https://hamlo-prod-web-git-migration-sel-bf2e3e-inkeritm-4372s-projects.vercel.app`
> (и этот же origin в CORS обоих бакетов —
> `AUTH_EXTRA_ORIGINS="…" npx tsx scripts/storage-provision.mts --check`).

---

## 6. Критерий завершения

- [x] source/target counts совпадают (раздел 1)
- [x] runtime не зависит от Supabase (раздел 3, `rg` + тест)
- [ ] полный Preview E2E пройден (раздел 5)
- [ ] Vercel Runtime Logs чисты
- [x] документация обновлена
- [x] production не затронут

Архив (`/home/deploy/secure-imports/hamloprod-supabase-2026-09-09/`) **не удалять**
до отдельного подтверждения владельца после прохождения Preview-гейта.
