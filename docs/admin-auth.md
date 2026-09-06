# Admin authentication — M6.1 (+ M6.1a security corrections)

Собственная email/password авторизация администратора на PostgreSQL. Заменяет
Supabase Auth для `/admin/*` и `/api/admin/*`. Публичная (покупательская)
авторизация, OAuth и восстановление пароля — вне M6.1 (этап M6.2).

Ветка `migration/self-hosted-backend`. Основа M6.1: `f51e20c`; M6.1a: `82df14b`.

**M6.1a** ужесточает: гонка ротации сессии, атомарный rate-limit с двумя
независимыми scope (email / IP), доверенный источник IP, честный logout (503 при
неудачном revoke), origin-check для storage-mutations, реальный UI-refresher,
create-admin отзывает старые сессии, `proxy.ts` удалён (без обращений к Supabase),
`Cache-Control: no-store` на всех auth-ответах.

---

## 1. Модель

| Часть | Где |
|---|---|
| Пароли (Argon2id) | [src/lib/auth/password.ts](../src/lib/auth/password.ts) — `argon2@0.45.1`, `argon2id`, `memoryCost 19456 KiB`, `timeCost 2`, `parallelism 1`; политика 12–128 символов; `verifyPassword` возвращает `false` (не бросает) для битого хэша |
| Сессии | [src/lib/auth/session.ts](../src/lib/auth/session.ts) — Prisma `Session`; токен = `randomBytes(32)` base64url; в БД только `HMAC-SHA256(SESSION_SECRET, token)`; TTL 8 часов |
| Cookie | [src/lib/auth/cookies.ts](../src/lib/auth/cookies.ts) — prod `__Host-hp_admin_session`, dev `hp_admin_session`; `HttpOnly; Secure(prod); SameSite=Lax; Path=/`; без `Domain`; `Max-Age` синхронно с `expiresAt` |
| Origin/CSRF | [src/lib/auth/origin.ts](../src/lib/auth/origin.ts) — allow-list `hamloprod.org`, `www.hamloprod.org`, `localhost:3000` + `AUTH_EXTRA_ORIGINS` (только из server env). Применяется в `login`/`logout`/`refresh` **и** в `/api/admin/storage/{upload-url,finalize}` (до обращения к S3) |
| Rate limit | [src/lib/auth/throttle.ts](../src/lib/auth/throttle.ts) + Prisma `AuthThrottle` — **два независимых scope**: `HMAC(email)` (10 / 15 мин) и `HMAC(ip)` (30 / 15 мин); блок при достижении любого. Счётчик обновляется одним `INSERT … ON CONFLICT DO UPDATE` (без потери инкрементов). email/IP открытым текстом не хранятся. Успешный логин чистит только email-scope, IP-scope остаётся |
| IP клиента | [src/lib/auth/request.ts](../src/lib/auth/request.ts) — только `x-vercel-forwarded-for`, затем `x-real-ip`. Клиентский `x-forwarded-for` принимается лишь вне production либо при `TRUST_FORWARDED_FOR=true`. `Host` для security-решений не используется. Значение, непригодное как `inet`, пишется в `Session.ip` как `NULL` |
| API | [src/app/api/admin/auth/](../src/app/api/admin/auth/) — `login`, `logout`, `refresh`, `me` (все `runtime = "nodejs"`, `Cache-Control: no-store`) |
| Скрипт bootstrap | [scripts/create-admin.ts](../scripts/create-admin.ts) |

Роли: `ADMIN`, `EDITOR` получают admin-доступ; `ARTIST`, `USER` — нет
([src/lib/auth/admin-roles.ts](../src/lib/auth/admin-roles.ts)).

---

## 2. Bootstrap администратора

`scripts/create-admin.ts` читает `ADMIN_BOOTSTRAP_EMAIL` и `ADMIN_BOOTSTRAP_PASSWORD`
**только из окружения** (никогда из CLI-аргумента — argv виден в `ps`). Пароль
хэшируется Argon2id и нигде не печатается. Идемпотентно: повторный запуск делает
`upsert` той же строки (по нормализованному email) и переустанавливает пароль/роль.

Безопасный запуск (bash; ведущий пробел не даёт строке попасть в history при
`HISTCONTROL=ignorespace`):

```bash
 read -rs -p 'admin password: ' ADMIN_BOOTSTRAP_PASSWORD; echo
 ADMIN_BOOTSTRAP_EMAIL='owner@example.com' ADMIN_BOOTSTRAP_PASSWORD="$ADMIN_BOOTSTRAP_PASSWORD" \
   npx tsx scripts/create-admin.ts
 unset ADMIN_BOOTSTRAP_PASSWORD
```

Требуется заполненный `DATABASE_URL` (роль `hamloprod_app`). Реальный администратор
без данных владельца не создаётся.

---

## 3. Жизненный цикл сессии

```
POST /api/admin/auth/login  { email, password }
  ├─ Origin не в allow-list ────────────────────► 403
  ├─ throttle заблокирован ─────────────────────► 429 (+ Retry-After)
  ├─ verify (dummy-hash если email неизвестен) ─► всегда выполняется
  ├─ !valid | не ADMIN/EDITOR ──────────────────► 401  (идентичный ответ)
  └─ ok ─► создать Session, Set-Cookie (8 ч) ───► 200 { ok: true }

GET  /api/admin/auth/me      → 200 { authenticated, user:{email,role}, session:{expiresAt, shouldRefresh} } | 401
POST /api/admin/auth/refresh → ротация ТОЛЬКО если shouldRefresh (осталось < TTL/2);
                                иначе { ok:true, refreshed:false }. Origin-check.
                                проигрыш гонки / невалидная сессия → 401 + cookie снята;
                                неожиданная ошибка БД → 500 (НЕ 401).
POST /api/admin/auth/logout  → revoke текущей session, затем Set-Cookie очистки (оба имени).
                                Idempotent при успехе; если revoke НЕ прошёл → 503,
                                cookie НЕ снимается (можно повторить). raw token не логируется.
```

**Валидация сессии** ([`validateAdminSession`](../src/lib/auth/session.ts)):
`revokedAt IS NULL` **и** `expiresAt > now` **и** `user.role ∈ {ADMIN, EDITOR}`.
Возвращаемый DTO не содержит `passwordHash` / `tokenHash` / raw token.

**Ротация без гонки** (`rotateAdminSession`): внутри одной транзакции —
условный `updateMany` (`tokenHash` совпал, `revokedAt IS NULL`, `expiresAt > now`).
Из двух параллельных refresh ровно один получает `count === 1` и продолжает;
второй получает `count === 0` → `null` (route → 401). Роль ADMIN/EDITOR
перепроверяется внутри транзакции. Неожиданные ошибки БД **пробрасываются**
(не превращаются в «невалидная сессия»). Cookie переставляется только в Route
Handler — Server Components куки не пишут.

**UI-refresher** ([AdminSessionRefresher](../src/components/admin/admin-session-refresher.tsx)):
подключён один раз в `src/app/admin/layout.tsx`. Раз в 5 мин + при монтировании
делает `GET /api/admin/auth/me`; при `shouldRefresh` — один `POST …/refresh`;
при 401 → `/admin/login`. Ref-guard от перекрытия вызовов, без цикла запросов,
токен/сессия в `localStorage` не хранятся. На `/admin/login` не активен.

**Проверка доступа страниц**: каждая `/admin/*` (кроме `/admin/login`) вызывает
`requireAdminSession()` → редирект на `/admin/login` при отсутствии сессии.
`src/proxy.ts` **удалён** — middleware к Supabase больше не обращается вообще
(ни для admin, ни для public).

---

## 4. Смена пароля / отзыв сессий

- **Сменить пароль администратора**: повторный запуск `scripts/create-admin.ts` с
  тем же email и новым паролем. В одной транзакции: `upsert` пароля/роли **и
  отзыв всех активных сессий** этого пользователя (старые логины сразу
  недействительны). Скрипт печатает число отозванных сессий, но не пароль/hash.
- **Отозвать все сессии пользователя** вручную:
  `revokeAllUserSessions(userId)` из [src/lib/auth/session.ts](../src/lib/auth/session.ts)
  (или `UPDATE sessions SET revoked_at = now() WHERE user_id = … AND revoked_at IS NULL`).
- **Отозвать одну сессию**: `revokeAdminSession({ sessionId })`.
- UI для смены пароля появится в M6.x; пока — через скрипт.

---

## 5. Переменные окружения

| Переменная | Обязательна | Назначение |
|---|---|---|
| `SESSION_SECRET` | да | HMAC-ключ хэширования session-токенов. Минимум 32 байта энтропии. Генерация: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATABASE_URL` | да | Runtime-подключение (роль `hamloprod_app`) |
| `AUTH_EXTRA_ORIGINS` | нет | Доп. allowed origins для mutation-запросов (через запятую), напр. preview-URL. Не выводится из Host-заголовка |
| `TRUST_FORWARDED_FOR` | нет | `"true"` — доверять клиентскому `x-forwarded-for` в production (только если сам деплой стоит за собственным доверенным прокси, который его перезаписывает). По умолчанию в production `x-forwarded-for` игнорируется |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | только для скрипта | Не коммитить. Передавать на один запуск |

Ошибки конфигурации (`AuthConfigError`, `StorageConfigError`) не содержат значений
секретов — только имена переменных. Отсутствие `SESSION_SECRET` → API отвечает `503`.

---

## 6. Ограничения M6.1 / M6.1a

- Только **admin**-авторизация. Публичный `getPublicSessionState`
  ([src/lib/auth/public-session.ts](../src/lib/auth/public-session.ts)) остаётся
  на Supabase до M6.2; публичные формы `src/components/auth/*` и
  `src/app/auth/callback` не тронуты. Middleware удалён — истёкшие Supabase-токены
  публичной сессии больше не рефрешатся автоматически (Supabase недоступен).
- Нет UI смены пароля, нет self-service сброса, нет OAuth, нет email-подтверждения.
- Старые admin CRUD-роуты (`/api/admin/beats` и т.п.) всё ещё используют Supabase
  для БД и **не** имеют origin-check (общий helper придёт в M2); авторизуются они
  уже собственной сессией. CRUD в UI отключён (`hasSupabase={false}`) до M2.
- `AuthThrottle` чистится оппортунистически (≈5% запросов), без cron.
- Пакеты `@supabase/*` и `src/lib/supabase/*` не удалены — удаляются по мере
  замены маршрутов.
- Тесты БД-конкурентности (`*.db.test.ts`) выполняются только когда есть
  `DATABASE_URL` + `SESSION_SECRET` (локально `npm test` подхватывает `.env`);
  в CI без `.env` — `skip`.

---

## 7. Проверки (выполнены — M6.1a)

`prisma validate` ✓ · `migrate status` up-to-date ✓ · schema drift — нет ✓ ·
`npm test` 106/106 (вкл. БД-тесты гонки ротации и throttle) ✓ · `npm run lint`
0 errors ✓ · `npm run build` ✓ · argon2 / `passwordHash` / `tokenHash` /
`SESSION_SECRET` / имя cookie отсутствуют в client-бандле ✓ · admin-auth path и
storage-роуты без Supabase-импортов, `src/proxy.ts` удалён ✓ ·
6 параллельных `POST /api/admin/auth/refresh` → ровно 1 новая сессия ✓ ·
storage `upload-url`/`finalize` отклоняют чужой/пустой Origin (403 до S3) ✓ ·
`Cache-Control: no-store` на всех auth-ответах ✓ · integration smoke
(login/cookie/dashboard/me/refresh/logout/replay/throttle) — все PASS, тестовые
данные удалены.
