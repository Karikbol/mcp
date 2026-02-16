# Telegram Bot Platform + MCP Server

This repository contains:
- **Telegram Bot Platform** — Client bot + WebApp (registration, login, Telegram ID recovery). Deploy to `/www/wwwroot/telegrambot/ybrjch.qgsm.store`.
- **MCP Server** — Optional add-on (orders, services, providers, admin chat). Sold separately; core product does not depend on it.

---

## Telegram Bot Platform (Client)

Production-ready Telegram Bot with WebApp registration/auth and secure recovery. Structured for commercial distribution (Docker Compose, backup/restore, installer placeholder, license hooks).

### Repo layout

- `app/` — Node (Telegraf + Fastify) client bot + WebApp + API
- `migrations/` — SQL migrations
- `docker/` — Dockerfiles and compose
- `scripts/` — install.sh, backup.sh, restore.sh
- `README.md` — this file

### Target directories (VPS)

| Bot     | Path on VPS |
|---------|----------------------------------------------|
| Client  | `/www/wwwroot/telegrambot/ybrjch.qgsm.store` |
| Admin   | `/www/wwwroot/telegrambot/jqidyrb.qgsm.store` |

Один и тот же репозиторий разворачивается в обе директории; в каждой свой `.env` (свой `BOT_TOKEN`, `WEBAPP_BASE_URL`) и при необходимости свой порт (клиент 3000, админ 3001).

### Paths

- Webhook: `/telegram-webhook`
- WebApp: `/webapp/register`, `/webapp/login`, `/webapp/recover`
- API: `/api/*`

### Setup

1. **Env**
   ```bash
   cp app/.env.example .env
   # Edit: BOT_TOKEN, WEBAPP_BASE_URL, ADMIN_IDS, DATABASE_URL (or POSTGRES_PASSWORD for Docker)
   ```

2. **Run with Docker Compose**
   ```bash
   docker compose -f docker-compose.telegram.yml up -d --build
   ```
   Migrations run on container startup.

3. **Or install script (prompts for env, creates .env, starts containers, prints webhook command)**
   ```bash
   ./scripts/install.sh
   ```

4. **Set Telegram webhook**
   ```bash
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://ybrjch.qgsm.store/telegram-webhook
   ```

### Nginx (aaPanel)

Proxy to `http://127.0.0.1:3000`:

- `/` → `http://127.0.0.1:3000`
- `/webapp/*` → `http://127.0.0.1:3000`
- `/telegram-webhook` → `http://127.0.0.1:3000`

Normal HTTP (no websocket/SSE required). HTTPS in production.

### Backup and restore

- **Backup** (dumps Postgres to `./backups/<date>.sql.gz`):
  ```bash
  ./scripts/backup.sh
  # Or: ./scripts/backup.sh /path/to/dir
  ```

- **Restore** (from a `.sql.gz` file; drops public schema then restores):
  ```bash
  ./scripts/restore.sh ./backups/telegram_bot_YYYYMMDD_HHMMSS.sql.gz
  ```
  Re-run migrations if needed:  
  `docker compose -f docker-compose.telegram.yml run --rm telegram-bot node dist/db/migrate.js`

### Загрузка на VPS (деплой в боевые директории)

На VPS разворачиваем в две папки для теста в реальном бою:

1. **Создать директории на VPS** (если ещё нет):
   ```bash
   sudo mkdir -p /www/wwwroot/telegrambot/ybrjch.qgsm.store
   sudo mkdir -p /www/wwwroot/telegrambot/jqidyrb.qgsm.store
   sudo chown "$USER:$USER" /www/wwwroot/telegrambot/ybrjch.qgsm.store
   sudo chown "$USER:$USER" /www/wwwroot/telegrambot/jqidyrb.qgsm.store
   ```

2. **Загрузить проект** (один из вариантов):
   - **Git** (если репо на сервере доступно):
     ```bash
     cd /www/wwwroot/telegrambot/ybrjch.qgsm.store && git clone <URL_репо> .   # клиент
     cd /www/wwwroot/telegrambot/jqidyrb.qgsm.store && git clone <URL_репо> .   # админ
     ```
   - **Ручная загрузка**: скопировать содержимое репо (папки `app/`, `docker/`, `migrations/`, `scripts/`, `docker-compose.telegram.yml` и т.д.) в обе директории (через scp, rsync или панель aaPanel → File).

3. **В каждой директории** создать `.env` и запустить:
   - **Клиент** (`ybrjch.qgsm.store`): `WEBAPP_BASE_URL=https://ybrjch.qgsm.store`, порт `3000`, свой `BOT_TOKEN`.
   - **Админ** (`jqidyrb.qgsm.store`): `WEBAPP_BASE_URL=https://jqidyrb.qgsm.store`, в compose задать порт `3001` (чтобы не конфликтовать с клиентом), свой `BOT_TOKEN`.
   Затем в каждой папке: `docker compose -f docker-compose.telegram.yml up -d --build`.

4. **В aaPanel** настроить два сайта: `ybrjch.qgsm.store` → proxy на `127.0.0.1:3000`, `jqidyrb.qgsm.store` → proxy на `127.0.0.1:3001`. Выдать SSL (Let's Encrypt).

5. **Webhook** для каждого бота:
   - Клиент: `https://api.telegram.org/bot<CLIENT_TOKEN>/setWebhook?url=https://ybrjch.qgsm.store/telegram-webhook`
   - Админ: `https://api.telegram.org/bot<ADMIN_TOKEN>/setWebhook?url=https://jqidyrb.qgsm.store/telegram-webhook`

### Migration to new VPS

1. On new VPS: install Docker, clone repo, copy `.env`.
2. Restore: run `./scripts/restore.sh <backup.sql.gz>` (with DB running or use `DATABASE_URL`).
3. Start: `docker compose -f docker-compose.telegram.yml up -d`.
4. Point domain and webhook to new host.

### Env (Telegram Platform)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | |
| `PORT` | 3000 | App port |
| `BOT_TOKEN` | - | Telegram bot token |
| `ADMIN_IDS` | - | Comma-separated Telegram IDs (string) |
| `WEBAPP_BASE_URL` | https://ybrjch.qgsm.store | No trailing slash |
| `WEBHOOK_PATH` | /telegram-webhook | |
| `DATABASE_URL` | - | Postgres URL (in Docker: postgresql://telegram_bot:...@postgres:5432/telegram_bot) |
| `SESSION_TTL_MIN` | 15 | Auth session TTL (minutes) |
| `RECOVERY_TOKEN_TTL_MIN` | 30 | Recovery token TTL (minutes) |
| `OTP_TTL_MIN` | 10 | OTP validity (minutes) |
| `OTP_MAX_ATTEMPTS` | 2 | Max OTP verify attempts |
| `OTP_MAX_SENDS` | 2 | Max OTP sends per recovery |
| `PIN_MAX_ATTEMPTS` | 3 | Max PIN attempts per recovery |
| `RECOVERY_LOCK_HOURS` | 24 | Lock duration after exhaustion |
| `FLOOD_PROTECTION_ENABLED` | false | Enable flood blocking |
| `FLOOD_HARD_BLOCK_ENABLED` | false | Stub for indefinite block after ≥3 blocks |
| `FLOOD_WINDOW_SEC` | 2 | Flood window (seconds) |
| `FLOOD_MAX_EVENTS` | 5 | Max events in window before block |
| `FLOOD_BLOCK_MIN` | 30 | Block duration (minutes) |
| `SMS_PROVIDER` | mock | mock \| real |
| `TOKEN_HASH_SECRET` | - | Optional secret for token hashing |
| `LICENSE_KEY` | - | Stub |
| `LICENSE_SERVER_URL` | - | Stub |

### Test plan

1. **/start as new user** → button «Регистрация» → register flow (name, phone, PIN) → user row created.
2. **/start as existing user** → button «Войти» → profile shown («Вы зарегистрированы» + name, masked phone, recovered flag).
3. **Recovery** — Admin runs `/issue_recovery <new_tg_id>` → open `/recover?token=...` → request OTP (neutral message) → verify OTP → verify PIN → `tg_id` updated, `tg_id_prev` preserved, `recovered_flag` true.
4. **Recovery with wrong phone** — Same flow; must show same neutral messages; audit logs show `recovery_phone_not_found`.
5. **Flood** — With `FLOOD_PROTECTION_ENABLED=false`: spam triggers audit only (`flood_suspected`). With enabled: user gets one block message, then further updates are ACK-only (no reply); bot stays alive.

### WebApp Security Model

- **Telegram-only** — The WebApp is intended to run only inside Telegram. Opening `/webapp/*` or calling `/api/*` from a normal browser returns **403** (or fails for API calls) because valid Telegram WebApp `initData` is required for API, and `/webapp/*` HTML is only served when the request comes from Telegram’s WebView (User-Agent check) or with valid initData.
- **Direct browser access blocked** — Opening `https://domain/webapp/register` in a normal browser returns 403. Opening the same URL from the Telegram app (WebApp button) works.
- **Session bound to Telegram user** — After verifying Telegram `initData`, the server binds the session to `tg_id`. For register and login, `session.tg_id` must equal the verified Telegram user id; otherwise the request is **401 Unauthorized**. A stolen session link cannot be used by another Telegram user.
- **Recovery tokens bound to new tg_id** — Recovery tokens are issued for a specific `bound_tg_id`. Every recovery endpoint checks that the verified Telegram user id equals `recovery_tokens.bound_tg_id`; otherwise **401**. Recovery cannot be abused with a stolen token from another account.
- **Rate limiting** — Lightweight in-memory rate limiting is applied to all `/api/*` routes: 60 requests per minute per user for general endpoints, 20 per minute for recovery endpoints. Exceeding returns **429 Too many requests** and is audited (`rate_limit_exceeded`).

---

# MCP Server (optional add-on)

Production-ready MCP server for a Telegram Bot project. Provides MCP tools for orders, services, providers, admin; internal admin chat; LLM via OpenAI API (optional Ollama fallback); bearer auth; rate limiting; audit logs.

## Tech Stack

- **Node.js 20** + TypeScript
- **Fastify** (chosen for performance, native TypeScript, built-in schema validation)
- **PostgreSQL** + **Redis**
- **MCP SDK** (Streamable HTTP + stdio)
- **OpenAI** API (default); optional **Ollama** as primary with OpenAI fallback
- **Docker Compose** + **nginx** + **systemd**

## VPS filesystem and shell tools (MCP)

Если MCP-сервер запущен на VPS, через Cursor доступны инструменты для файлов и команд в ограниченной директории:

| Tool | Описание |
|------|----------|
| `vps_fs_list` | Показать файлы/папки (путь относительно базы или под ней). |
| `vps_fs_copy` | Копировать файл или директорию. |
| `vps_fs_move` | Переместить (переименовать) файл или директорию. |
| `vps_shell_exec` | Выполнить команду в shell (например `ls -la`, `cp -r MCP ybrjch.qgsm.store`, `docker compose up -d`). Таймаут по умолчанию 60 с. |

Все пути ограничены базовой директорией **VPS_FS_BASE_PATH** (по умолчанию `/www/wwwroot/telegrambot`). Чтобы контейнер MCP видел эту папку на хосте, в `docker-compose.yml` для сервиса `mcp` подключён volume:

```yaml
volumes:
  - ${VPS_FS_MOUNT_PATH:-/www/wwwroot/telegrambot}:/www/wwwroot/telegrambot
```

Переменные окружения (опционально): `VPS_FS_BASE_PATH`, `VPS_FS_MOUNT_PATH` (путь на хосте для монтирования), `VPS_SHELL_TIMEOUT_SEC` (таймаут для `vps_shell_exec`, по умолчанию 60).

## Project Structure

```
MCP/
├── src/
│   ├── config.ts           # Env config, secret masking
│   ├── logger.ts           # Pino, token masking
│   ├── index.ts            # HTTP Fastify app + MCP /mcp
│   ├── stdio-entry.ts      # Stdio entry for Cursor
│   ├── mcp/
│   │   └── server.ts       # McpServer + tools
│   ├── tools/
│   │   ├── index.ts        # Tool handlers
│   │   └── vpsFs.ts        # VPS fs list/copy/move, shell exec
│   ├── llm/
│   │   └── router.ts       # OpenAI / Ollama+fallback
│   ├── db/
│   │   ├── client.ts       # pg pool
│   │   └── migrate.ts      # Migrations
│   ├── redis/
│   │   └── client.ts       # ioredis
│   └── middleware/
│       ├── auth.ts         # Bearer auth
│       ├── rateLimit.ts    # Redis rate limit
│       └── audit.ts        # Audit logging
├── app/                    # Telegram Bot Platform
│   ├── src/
│   │   ├── bot/            # Telegraf, start, issue_recovery, flood
│   │   ├── routes/         # API + webapp
│   │   ├── api/            # register, login, recover
│   │   ├── services/       # flood
│   │   ├── db/             # client, users, authSessions, etc.
│   │   └── ...
│   └── public/             # WebApp HTML/JS
├── migrations/             # Telegram platform SQL
├── docker/
├── docker-compose.yml      # MCP
├── docker-compose.telegram.yml
├── scripts/
│   ├── install.sh         # Telegram platform installer
│   ├── backup.sh
│   └── restore.sh
├── .env.example
└── README.md
```

(Additional MCP sections from original README follow for quickstart, deploy, endpoints, env, etc.)
