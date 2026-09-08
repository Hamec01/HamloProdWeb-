# Аудит инфраструктуры — M1.1

Статус: read-only аудит VPS перед этапом M1 (PostgreSQL foundation).
Дата: 2026-09-06. Ветка: `migration/self-hosted-backend`.
Основание: `roadmap_v2.md` (разделы 3, 11, 15, 16 M1), `docs/migration-from-supabase.md`
(«Точный следующий этап M1»).

Ничего не установлено и не изменено. Сервисы, firewall и production env не трогались.
Supabase не удалялся. Секреты в документ не вынесены.

## 0. Ограничения аудита

- Пользователь `deploy` **без passwordless sudo**. Недоступны: `ufw status` с правилами,
  `iptables -S` / `nft list ruleset`, владельцы привилегированных сокетов в `ss`,
  `fail2ban-client status`, содержимое `/etc/ufw/user.rules`.
- Нет доступа к панели/API Contabo — состав bucket'ов, политики и CORS проверить нельзя
  (см. раздел 8).
- Данные о live-схеме Supabase не снимались (это отдельный шаг M1, п. 6 плана).
- Проект `D:\LICENSE MAKER` вне зоны аудита (задача отменена пользователем).

## 1. Резюме (ключевые выводы)

| Тема | Состояние | Вывод для миграции |
|---|---|---|
| VPS | Ubuntu 24.04.4 LTS, 4 vCPU AMD EPYC, 7.8 GiB RAM, swap 4 GiB (1.2 GiB занято), диск 145 GiB (58% занято, ~62 GiB свободно) | Для metadata-only PostgreSQL ресурсов достаточно; RAM — узкое место, нужен аккуратный тюнинг и мониторинг |
| Выделенный PostgreSQL для HamloProd | **Отсутствует** | Создаём с нуля на M1 |
| PostgreSQL вообще | 8 контейнеров `postgres:16*` соседних проектов (titanor-time, collab-studio, ardor, t97-pilot, тестовые БД) | Есть проверенный на этом VPS способ запуска PG в Docker; ставить рядом свой инстанс, не трогая чужие |
| Публичный доступ к любому PG | Нет: контейнеры либо во внутренних docker-сетях, либо bind на `127.0.0.1` | Правильный ориентир — не публиковать 5432 в интернет |
| Firewall | `ufw` **active + enabled**; правила прочитать нельзя без sudo | **Docker публикует порты в обход UFW** (daemon.json дефолтный) — критично для того, как выставлять порт БД |
| Backup HamloProd | **Отсутствует** | На M1 добавить `pg_dump` + off-box копию по образцу соседних проектов |
| Backup-паттерн VPS | systemd oneshot + timer, конфиг в `/etc/<project>/*.env` (0600), скрипт в `ops/`, off-box копия в Contabo `/mnt/250gb`, `OnFailure=` нотификатор | Переиспользуем один в один для HamloProd |
| Contabo Object Storage | Аккаунт рабочий: endpoint `https://usc1.contabostorage.com`, region `usc1`, path-style, есть bucket `250gb` (общий, под бэкапы) смонтирован через s3fs | Endpoint/режим известны; `hamloprod-public` / `hamloprod-private`, ключи, политики и CORS — **не проверены**, создаются на M7 |
| Reverse proxy | Caddy (host) обслуживает домены соседних проектов; HamloProd в Caddy **не значится** | Сам сайт на Vercel — proxy для приложения не нужен; Caddy может понадобиться только как TLS-точка для `db.hamloprod.org` |
| Сайт | `hamloprod.org` → Vercel (`216.198.79.65`, `64.29.17.65`) | Подтверждает схему «Vercel (app) + VPS (DB) + Contabo (files)» |

VPS (Contabo VPS): IPv4 `84.247.130.242`, IPv6 `2a02:c207:2340:7580::/64`, hostname `vmi3407580`,
таймзона Europe/Berlin, uptime ~61 день, unattended-upgrades включены.

## 2. VPS: железо и ОС

```
OS            Ubuntu 24.04.4 LTS (noble), kernel 6.8.0-134-generic x86_64
CPU           AMD EPYC (with IBPB), 4 vCPU (4 ядра, 1 поток на ядро)
RAM           7.8 GiB total; на момент аудита ~3.9 GiB available
Swap          4.0 GiB (swapfile /swapfile), ~1.2 GiB уже используется
Load avg      ~0.7–1.0 (спокойно)
Автообновления apt Periodic::Unattended-Upgrade = 1
```

Наблюдение: swap уже частично задействован при ~14 запущенных контейнерах — запас оперативной
памяти небольшой. Новый инстанс PostgreSQL + PgBouncer нужно конфигурировать «скромно»
(`shared_buffers` ~256 MB, `effective_cache_size` ~768 MB, невысокий `max_connections` за пулером).

## 3. Диски и хранилище

```
/dev/sda1   ext4   145G   83G занято   62G свободно   /        (58%)
/dev/sda16  ext4   881M               /boot
/dev/sda15  vfat   105M               /boot/efi
s3fs        fuse   4.0G   0           /mnt/250gb  ← Contabo bucket "250gb" (общий, бэкапы соседних проектов)
```

Каталог данных приложений: `/home/deploy/app-data/<project>/` (владелец `deploy:deploy`).
Пример: `/home/deploy/app-data/titanor-time-prod/{uploads,gps-archive-staging}`.
Для HamloProd логично `/home/deploy/app-data/hamloprod/pgdata`.

Метаданные (users/beats/tracks/orders/…) без аудиофайлов — это единицы–десятки МБ на старте
и небольшой рост. Дискового запаса достаточно надолго. WAV/MP3 на VPS не кладём (roadmap п. 18).

## 4. Запущенные системные сервисы

```
caddy.service        reverse proxy соседних проектов (host), admin API на 127.0.0.1:2019
docker.service       + containerd — основная нагрузка VPS
fail2ban.service     active (джейлы прочитать без root нельзя)
udisks2, systemd-*   штатное
```

Нет: host-PostgreSQL, nginx на хосте (nginx есть только внутри контейнера `ardor_web_staging`),
Tailscale / cloudflared / WireGuard / rclone / s3cmd / aws-cli.
Node.js на хосте: v22.23.1, npm 10.9.8. Клиента `psql` / `pg_dump` на хосте нет.

## 5. Docker-инвентарь (соседи по VPS)

Запущено ~14 контейнеров нескольких независимых проектов. Относящихся к HamloProd — **нет**.

Публично (`0.0.0.0`) слушают только:

```
ardor_web_staging   0.0.0.0:8080 -> 80
ardor_api_staging   0.0.0.0:8000 -> 8000
```

Все `postgres:16*` контейнеры (`titanor-time-*-db`, `collab-studio-postgres-1`,
`ardor_postgres_staging`, `t97-pilot-db`, тестовые `*-testdb`) — **без публикации в интернет**:
либо только во внутренней docker-сети (`5432/tcp` без host-bind), либо `127.0.0.1:554xx->5432`.

Docker-сети: `bridge`, `deploy_default`, плюс per-project сети (`titanor-time_*`,
`collab-studio_default`, `t97-pilot-net`, `titanorgroup_default`).

Потребление RAM контейнерами PG невелико (25–95 MiB каждый) — это следствие низкого трафика,
а не лимита; под реальной нагрузкой HamloProd потребует больше.

Наблюдение по безопасности (общий паттерн, без раскрытия значений): у существующих PG-контейнеров
пароль задан inline через `POSTGRES_PASSWORD=` в `Config.Env`, то есть виден любому члену группы
`docker` через `docker inspect`. Для HamloProd использовать `env_file` с правами `0600` либо
Docker secrets, не inline-переменную.

## 6. Сеть и firewall

Слушатели на хосте (важное):

```
:22            SSH (v4+v6)
:80, :443      Caddy (host)  — v4/v6, + :443/udp (HTTP/3)
0.0.0.0:8000   ardor_api_staging  (docker publish)
0.0.0.0:8080   ardor_web_staging  (docker publish)
127.0.0.1:2019 Caddy admin API
127.0.0.1:3000/3100/3199 приложения соседних проектов (за Caddy)
127.0.0.1:553xx/554xx  тестовые/preview БД (localhost only)
127.0.0.53/54:53  systemd-resolved
```

- `ufw` **active и enabled**. Конкретные правила без sudo недоступны — снять на M1
  (`sudo ufw status verbose`, `sudo iptables -S`, `sudo nft list ruleset`).
- **`/etc/docker/daemon.json` отсутствует → дефолтная интеграция Docker с iptables.**
  Это значит: любой контейнерный порт, опубликованный как `-p 5432:5432` или `-p 0.0.0.0:...`,
  **обходит UFW** и становится доступен из интернета, даже если в UFW стоит `deny`.
  Порт БД нельзя защищать одним UFW — нужен либо bind на конкретный интерфейс, либо явное
  правило в цепочке `DOCKER-USER`, либо туннель.
- Активных внешних соединений к `:5432/:6432` сейчас нет — внешняя БД никем не используется.
- `fail2ban` работает; состав джейлов уточнить на M1 (нужен джейл на попытки аутентификации
  к порту БД / пулеру).

## 7. PostgreSQL — текущее состояние

- **Выделенного PostgreSQL для HamloProd нет** (ни на хосте, ни в контейнере).
- На хосте PostgreSQL не установлен (`apt`), кластеров `pg_lsclusters` нет.
- Есть рабочий, повторяемый способ запускать `postgres:16` в Docker (8 живых примеров).
- Приложение HamloProd живёт на Vercel — то есть, в отличие от соседних проектов,
  подключение к БД будет **внешним** (Vercel → VPS), а не по локальной docker-сети.
  Это главное архитектурное отличие, определяющее раздел 9.

## 8. Contabo Object Storage — что известно и что нет

Известно (из смонтированного s3fs `/mnt/250gb` и `/etc/fstab`):

```
S3 endpoint     https://usc1.contabostorage.com
Region          usc1  (US Central)
Request style   path-style  (S3_FORCE_PATH_STYLE = true)
Существующий bucket  "250gb"  — общий, используется под бэкапы соседних проектов
Учётка          один ключ в /home/deploy/.passwd-s3fs (значение не раскрывается)
Связность       VPS → endpoint по HTTPS работает (проверено, ответ 401 на анонимный запрос — норма)
```

**Не проверено (нет доступа к панели/S3 API, CLI не установлены):**

- существуют ли `hamloprod-public` / `hamloprod-private`;
- политики bucket'ов (public GET / private deny), настройки CORS;
- квота плана (roadmap упоминает 500 GB) и текущее использование;
- есть ли/нужен ли отдельный access key для HamloProd (не переиспользовать бэкапный ключ
  `250gb` для медиа приложения).

Вывод: Contabo для медиа настраивается на **M7** (roadmap раздел 16). На M1 от Contabo нужен
только один пункт — **приёмник для бэкапов БД** (можно временно тот же bucket `250gb`,
префикс `hamloprod/`, либо сразу отдельный bucket + ключ).

## 9. Безопасное подключение Vercel → PostgreSQL на VPS

### Условие задачи

Vercel Functions (Hobby/Pro) выходят в интернет с **широкого динамического пула IP** — надёжный
IP-allowlist невозможен без Vercel **Secure Compute** (Enterprise, статические egress IP).
Значит защищаемся на транспортном и прикладном уровне, а не списком адресов.
Плюс модель serverless = много коротких подключений → нужен пул соединений.

> **M1.3 (2026-09-08):** этот вариант реализован как конфиг в `deploy/preview-db/`
> и задокументирован в `docs/preview-db-connection.md` (PgBouncer overlay,
> `pgbouncer.ini`, cert-runbook, `DOCKER-USER`/fail2ban, `scripts/db-connection-check.mts`).
> Проверено локально (loopback + self-signed CA): 8/8. Не активировано —
> ждёт действий владельца (DNS, LE-сертификат, публикация порта, Vercel Preview).

### Рекомендуемый вариант для M1 (вариант A + харденинг)

```
Vercel Function
   │  DATABASE_URL = postgres://hamloprod_app:***@db.hamloprod.org:6432/hamloprod
   │                 ?sslmode=verify-full&sslrootcert=/var/task/certs/hamloprod-ca.pem
   ▼
db.hamloprod.org:6432  (публичный, только TLS)
   ▼  PgBouncer (transaction pooling)  — контейнер, bind на нужный интерфейс
   ▼
PostgreSQL 16  127.0.0.1 / внутренняя docker-сеть : 5432   (в интернет НЕ публикуется)
   ▲
   └── DIRECT_URL = postgres://hamloprod_migrator:***@<tunnel|localhost>:5432/hamloprod
       (только для Prisma migrate, доступ через Tailscale/SSH-туннель, не публичный)
```

Обязательные меры:

1. **Порт наружу — только PgBouncer**, и с учётом обхода UFW: публиковать через
   `-p 5432` **нельзя без** параллельного правила в `DOCKER-USER`. Явно ограничить источник
   (когда появятся статические IP — на них; до этого — минимум rate-limit + fail2ban).
2. **TLS обязателен**: `ssl = on`, в `pg_hba.conf` только `hostssl … scram-sha-256`,
   отдельный сертификат для `db.hamloprod.org` (Let's Encrypt через DNS-01 или отдельный
   Caddy-сайт; VPS до LE достучаться может — проверено). На стороне Vercel — `sslmode=verify-full`
   + закреплённый `sslrootcert`, без отключения проверки сертификата.
3. **Роли по минимуму привилегий**:
   - `hamloprod_app` — только DML на схему приложения, без DDL, `CONNECTION LIMIT`;
   - `hamloprod_migrator` — владелец схемы, DDL, доступ только по приватному каналу;
   - `hamloprod_admin` / ops — локально.
4. **Пул**: PgBouncer в режиме `transaction`; на стороне Prisma — низкий `connection_limit`
   в pooled URL, отдельный `directUrl` для миграций (Prisma это поддерживает штатно).
5. **fail2ban** — джейл на лог PgBouncer/PostgreSQL (повторные отказы аутентификации), плюс
   нестандартный внешний порт (6432, не 5432).
6. **Egress-переключатель на будущее**: как только появится Vercel Secure Compute либо
   прокси со статическим IP — добавить IP-allowlist в `DOCKER-USER`/`nftables` как ещё один слой.

### Что НЕ рекомендуется как основной путь

- **Публиковать 5432 напрямую** (даже с паролем) — обход UFW + прямой перебор.
- **Cloudflare Tunnel / Tailscale как канал для самих Vercel Functions** — serverless-рантайм
  не держит демон туннеля; это неудобно и хрупко. Tailscale целесообразен **только для
  операторского доступа** (psql, `pg_dump`, `prisma migrate` с рабочей машины) и для `DIRECT_URL`.
- **IP-allowlist по «текущим» IP Vercel** — они не статические на Hobby/Pro.

### Резервный (более простой) путь, если публичный TLS-эндпойнт не согласуют

PgBouncer слушает только на Tailscale-интерфейсе VPS; на Vercel используется внешний
управляемый пул (например, через отдельный always-on прокси). Дороже в поддержке — рассматривать,
только если публичный TLS-эндпойнт по политике безопасности недопустим.

## 10. Резервное копирование

### Текущий паттерн VPS (переиспользуемый образец)

- `systemd` oneshot service + timer, шаблон по окружению (`titanor-time-backup@%i.service`);
- конфиг каждого инстанса — `/etc/<project>/backup-<env>.env`, режим `0600`, `root:root`;
- скрипт бэкапа лежит в репозитории проекта (`ops/<project>/backup-*.sh`);
- off-box копия — на s3fs-маунт Contabo `/mnt/250gb`;
- `OnFailure=<project>-backup-failed@%i.service` — нотификатор, **не печатает секреты**;
- `Nice=10`, `IOSchedulingClass=idle`, `TimeoutStartSec=1800`.

Живые примеры таймеров: `titanorgroup-backup.timer` (ежедневно ~03:30),
`titanor-time-backup@production.timer` (~06:18), `titanor-time-gps-archive@production.timer`.

### Для HamloProd (добавить на M1)

- `pg_dump -Fc` (custom format) ежедневно; ретенция по roadmap разд. 15: **7 daily / 4 weekly / 3 monthly**;
- хранить: локально `/home/deploy/backups/hamloprod/` **и** off-box (Contabo; желательно
  отдельный bucket/ключ, не бэкапный `250gb`);
- мониторинг падений через `OnFailure=` нотификатор;
- **регулярная репетиция восстановления** `pg_restore` в чистую БД (обязательный gate M1, п. 7 плана);
- приватные медиа (позже, M9) — дополнительная независимая копия, не только тот же Contabo.

## 11. Риски и наблюдения

| # | Риск / наблюдение | Действие |
|---|---|---|
| R1 | Docker публикует порты **в обход UFW** (дефолтный daemon.json). Наивное `-p 5432:5432` откроет БД всему интернету | Раздел 9: bind на интерфейс + `DOCKER-USER`, порт только у PgBouncer, TLS+SCRAM |
| R2 | Vercel Hobby/Pro без статических egress IP — IP-allowlist недоступен | Защита на TLS+SCRAM+пул+fail2ban; IP-allowlist отложить до Secure Compute |
| R3 | RAM 7.8 GiB, swap уже частично занят, ~14 контейнеров | Скромный тюнинг PG/PgBouncer; мониторинг; рассмотреть апгрейд RAM до этапов медиа (M8–M9) и до cutover |
| R4 | Нет доступа sudo у аудитора — правила UFW/iptables/nft, джейлы fail2ban не проверены | Снять на старте M1 под привилегированной сессией, зафиксировать здесь же |
| R5 | Contabo bucket'ы/политики/CORS/квота HamloProd не проверены (нет API/панели/CLI) | Настройка и проверка — на M7; на M1 нужен только приёмник бэкапов |
| R6 | У соседних PG-контейнеров пароль виден через `docker inspect` (группа `docker`) | Для HamloProd — `env_file 0600` или Docker secrets, не inline `POSTGRES_PASSWORD` |
| R7 | Публично открыты `:8000` / `:8080` (ardor staging) — чужой проект, но общий VPS | Вне периметра миграции; отметить владельцу VPS отдельно |
| R8 | Live-схема Supabase не сверялась с SQL в репозитории (M0 это отметил) | Schema-only export из Supabase до написания Prisma-схемы (M1, п. 3–4) |
| R9 | Один s3fs-ключ на всё → компрометация = доступ ко всем бэкапам VPS | Для HamloProd — отдельный ключ/bucket; на будущее рекомендовать владельцу разнести ключи |

## 12. Точный план следующего этапа (M1 — PostgreSQL foundation)

Порядок; production не переключается; `DATA_BACKEND` остаётся `supabase`.

1. **Привилегированная ревизия периметра** (нужен sudo). Снять и зафиксировать в этом файле:
   `ufw status verbose`, `iptables -S`, `nft list ruleset`, `fail2ban-client status`,
   политику цепочки `DOCKER-USER`. Убедиться, что 5432 нигде не открыт наружу.
2. **DNS**: завести `db.hamloprod.org` → `84.247.130.242` (A) / IPv6 (AAAA). Нужен для TLS-сертификата
   и стабильного `DATABASE_URL`.
3. **PostgreSQL 16 в Docker** рядом с соседними инстансами:
   - данные в `/home/deploy/app-data/hamloprod/pgdata`;
   - контейнер **не публикует** 5432 наружу (только внутренняя сеть / `127.0.0.1`);
   - `env_file` с правами `0600` (не inline-пароль);
   - тюнинг под RAM (`shared_buffers≈256MB`, `effective_cache_size≈768MB`,
     `max_connections≈100`, умеренный `work_mem`);
   - `ssl = on`, серверный сертификат для `db.hamloprod.org`.
4. **Роли и БД**: `hamloprod` (БД); роли `hamloprod_app` (DML, `CONNECTION LIMIT`),
   `hamloprod_migrator` (владелец схемы/DDL), ops-роль (локально). `pg_hba.conf` — только
   `hostssl … scram-sha-256` для внешних, `scram-sha-256` для локальных.
5. **PgBouncer** (контейнер), режим `transaction`; внешний порт `6432` только по TLS;
   публикация с учётом R1 (bind на интерфейс + правило `DOCKER-USER`, rate-limit).
6. **TLS-эндпойнт**: сертификат Let's Encrypt для `db.hamloprod.org` (DNS-01 или отдельный
   Caddy-сайт), закрепить CA-файл для `sslmode=verify-full` на стороне Vercel.
7. **Приватный канал для миграций**: Tailscale или SSH-туннель для `DIRECT_URL`
   (`hamloprod_migrator` → 5432 напрямую, без публичного доступа).
8. **Prisma в проекте** (код, без переключения рантайма): закреплённые версии,
   `prisma/schema.prisma`, `src/lib/db/client.ts` с переиспользуемым пулом,
   `datasource` с `url = DATABASE_URL` (pooled) и `directUrl = DIRECT_URL`.
   Перенести **все** таблицы из inventory M0 (включая поздние `ALTER TABLE`), сохранить UUID и FK.
9. **Schema-only сверка Supabase**: `pg_dump --schema-only` из Supabase (без данных, без секретов),
   сверить применённые миграции / RLS / constraints с SQL в репозитории; расхождения — в этот файл.
10. **Экспорт/импорт вхолостую**: повторяемый скрипт с mapping / counts / checksums, dry-run на
    staging-БД; identity-bridge для `users` (UUID) до зависимых строк; миграция паролей — отдельно на M6.
    Никаких production-миграций на этом шаге.
11. **Бэкап HamloProd**: `pg_dump -Fc` daily по образцу раздела 10 (systemd timer + `/etc/hamloprod/backup.env` 0600),
    ретенция 7/4/3, локально + off-box Contabo, `OnFailure=` нотификатор без секретов,
    **проверить `pg_restore` в чистую БД**.
12. **Конфиг-переключатель**: серверный `DATA_BACKEND` (default `supabase`, fail-closed на неверном
    значении); PostgreSQL-фабрика подключается по готовности адаптеров (M2+). Production env не менять.
13. **Гейты выхода M1**: чистый прогон migrate/restore; TLS-коннект из Vercel Preview
    (`sslmode=verify-full`); бюджет соединений согласован с конкурентностью Vercel; FK/constraints целы;
    в браузер не утекают креды БД; `npm run lint` и `npm run build` зелёные;
    **отдельный commit M1**; результат — infrastructure foundation, не cutover.

## 13. Что в этом аудите НЕ делалось

- Не устанавливались пакеты, не менялись сервисы, firewall, docker daemon, production env.
- Supabase и его зависимости не трогались.
- Не создавались БД, роли, контейнеры, букеты, DNS-записи, сертификаты.
- Live-БД Supabase, Contabo S3 API и production smoke — вне M1.1 (частично на M1, далее по roadmap).
- Секреты (пароли БД соседних проектов, ключ s3fs, содержимое `.env`) в документ не выносились.
