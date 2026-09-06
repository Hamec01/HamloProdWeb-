# Admin authentication — M6.1

Собственная email/password авторизация администратора на PostgreSQL. Заменяет
Supabase Auth для `/admin/*` и `/api/admin/*`. Публичная (покупательская)
авторизация, OAuth и восстановление пароля — вне M6.1 (этап M6.2).

Ветка `migration/self-hosted-backend`. Основа: `f51e20c`.

---

## 1. Модель

| Часть | Где |
|---|---|
| Пароли (Argon2id) | [src/lib/auth/password.ts](../src/lib/auth/password.ts) — `argon2@0.45.1`, `argon2id`, `memoryCost 19456 KiB`, `timeCost 2`, `parallelism 1`; политика 12–128 символов; `verifyPassword` возвращает `false` (не бросает) для битого хэша |
| Сессии | [src/lib/auth/session.ts](../src/lib/auth/session.ts) — Prisma `Session`; токен = `randomBytes(32)` base64url; в БД только `HMAC-SHA256(SESSION_SECRET, token)`; TTL 8 часов |
| Cookie | [src/lib/auth/cookies.ts](../src/lib/auth/cookies.ts) — prod `__Host-hp_admin_session`, dev `hp_admin_session`; `HttpOnly; Secure(prod); SameSite=Lax; Path=/`; без `Domain`; `Max-Age` синхронно с `expiresAt` |
| Origin/CSRF | [src/lib/auth/origin.ts](../src/lib/auth/origin.ts) — allow-list `hamloprod.org`, `www.hamloprod.org`, `localhost:3000` + `AUTH_EXTRA_ORIGINS` (только из server env) |
| Rate limit | [src/lib/auth/throttle.ts](../src/lib/auth/throttle.ts) + Prisma `AuthThrottle` — ключ = `HMAC(email+IP)`, email/IP открытым текстом не хранятся; 10 неудач / 15 мин → блок на 15 мин |
| API | [src/app/api/admin/auth/](../src/app/api/admin/auth/) — `login`, `logout`, `refresh`, `me` (все `runtime = "nodejs"`) |
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
                                иначе { ok:true, refreshed:false }. Origin-check. 401 → cookie снята.
POST /api/admin/auth/logout  → revoke текущей session, Set-Cookie очистки (оба имени). Idempotent.
```

**Валидация сессии** ([`validateAdminSession`](../src/lib/auth/session.ts)):
`revokedAt IS NULL` **и** `expiresAt > now` **и** `user.role ∈ {ADMIN, EDITOR}`.
Возвращаемый DTO не содержит `passwordHash` / `tokenHash` / raw token.

**Ротация** (`rotateAdminSession`): старую сессию `revokedAt = now()` и новую
создаём в одной Prisma-транзакции. Повторное использование старого токена после
ротации не проходит валидацию. Cookie переставляется только в Route Handler
(`/api/admin/auth/refresh`) — Server Components куки не пишут.

**Проверка доступа страниц**: каждая `/admin/*` (кроме `/admin/login`) вызывает
`requireAdminSession()` → редирект на `/admin/login` при отсутствии сессии.
`src/proxy.ts` больше не обновляет Supabase-сессию для `/admin/*` и `/api/admin/*`.

---

## 4. Смена пароля / отзыв сессий

- **Сменить пароль администратора**: повторный запуск `scripts/create-admin.ts` с
  тем же email и новым паролем (переустановит `passwordHash`). Существующие сессии
  при этом **не** отзываются автоматически.
- **Отозвать все сессии пользователя** (после смены пароля / компрометации):
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
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | только для скрипта | Не коммитить. Передавать на один запуск |

Ошибки конфигурации (`AuthConfigError`, `StorageConfigError`) не содержат значений
секретов — только имена переменных. Отсутствие `SESSION_SECRET` → API отвечает `503`.

---

## 6. Ограничения M6.1

- Только **admin**-авторизация. Публичный `getPublicSessionState`
  ([src/lib/auth/public-session.ts](../src/lib/auth/public-session.ts)) остаётся
  на Supabase до M6.2; публичные формы `src/components/auth/*` и
  `src/app/auth/callback` не тронуты.
- Нет UI смены пароля, нет self-service сброса, нет OAuth, нет email-подтверждения.
- Старые admin CRUD-модули (`/admin/beats` и т.п.) отрисовываются, но CRUD
  **отключён** (`hasSupabase={false}`) до M2 — авторизация не включает старый
  Supabase CRUD.
- `AuthThrottle` чистится оппортунистически (≈5% запросов), без cron.
- Пакеты `@supabase/*` и `src/lib/supabase/*` не удалены — удаляются по мере
  замены маршрутов.
- Один инстанс rate-limit хранит счётчик в БД (подходит для multi-instance
  Vercel); при экстремальной нагрузке возможен race на `upsert` — приемлемо для M6.1.

---

## 7. Проверки (выполнены)

`prisma validate` ✓ · `migrate status` up-to-date ✓ · schema drift — нет ✓ ·
миграция с нуля (`init` + `add_auth_throttle`) ✓ · `npm test` 88/88 ✓ ·
`npm run lint` 0 errors ✓ · `npm run build` ✓ · argon2 / `passwordHash` /
`tokenHash` / `SESSION_SECRET` отсутствуют в client-бандле ✓ · admin-auth path и
storage-роуты без Supabase-импортов ✓ · integration smoke (login/cookie/dashboard/
logout/replay/rotation/throttle/foreign-origin) — все PASS, тестовые данные удалены.
