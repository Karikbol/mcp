# Telegram Bot MCP Server

Production-ready MCP server for a Telegram Bot project. Provides MCP tools for orders, services, providers, admin; internal admin chat; LLM router (Ollama → OpenAI fallback); bearer auth; rate limiting; audit logs.

## Tech Stack

- **Node.js 20** + TypeScript
- **Fastify** (chosen for performance, native TypeScript, built-in schema validation)
- **PostgreSQL** + **Redis**
- **MCP SDK** (Streamable HTTP + stdio)
- **Ollama** (DeepSeek, CPU-friendly) + **OpenAI** fallback
- **Docker Compose** + **nginx** + **systemd**

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
│   │   └── index.ts        # Tool handlers
│   ├── llm/
│   │   └── router.ts       # Ollama → OpenAI fallback
│   ├── db/
│   │   ├── client.ts       # pg pool
│   │   └── migrate.ts      # Migrations
│   ├── redis/
│   │   └── client.ts       # ioredis
│   └── middleware/
│       ├── auth.ts         # Bearer auth
│       ├── rateLimit.ts    # Redis rate limit
│       └── audit.ts        # Audit logging
├── docker-compose.yml
├── Dockerfile
├── nginx/
│   └── mcp.qgsm.store.conf
├── systemd/
│   └── mcp-server.service
├── scripts/
│   └── deploy.sh
├── .env.example
├── .cursor/
│   └── mcp.json.example
└── README.md
```

## Quickstart (Local)

### Windows / Linux

1. Clone and install:
   ```bash
   git clone <repo> MCP && cd MCP
   cp .env.example .env
   # Edit .env: MCP_BEARER_TOKEN, ADMIN_IDS, DATABASE_URL, REDIS_URL
   npm install
   ```

2. Start PostgreSQL and Redis (Docker or local):
   ```bash
   docker compose up -d postgres redis
   ```

3. Migrate and run:
   ```bash
   npm run migrate
   npm run dev
   ```

4. Check:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3100/health
   ```

### stdio (Cursor local)

```bash
npm run build
npm run dev:stdio
```

Or in `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "telegram-bot-mcp": {
      "command": "node",
      "args": ["d:/MCP/dist/stdio-entry.js"]
    }
  }
}
```

## Quickstart (VPS Ubuntu 22.04)

1. Clone to `/opt/mcp`:
   ```bash
   sudo mkdir -p /opt/mcp && sudo chown $USER /opt/mcp
   git clone <repo> /opt/mcp
   cd /opt/mcp
   ```

2. Create `.env`:
   ```bash
   cp .env.example .env
   nano .env   # MCP_BEARER_TOKEN, ADMIN_IDS, OPENAI_API_KEY (optional)
   ```

3. Pull Ollama model (CPU-friendly):
   ```bash
   docker compose up -d ollama
   docker exec -it mcp-ollama-1 ollama pull deepseek-r1:1.5b
   ```

4. Build and run:
   ```bash
   npm ci
   npm run migrate
   npm run build
   docker compose up -d --build
   ```

5. Nginx + SSL:
   - Copy `nginx/mcp.qgsm.store.conf` to `/etc/nginx/sites-available/`
   - `sudo ln -s /etc/nginx/sites-available/mcp.qgsm.store.conf /etc/nginx/sites-enabled/`
   - `sudo certbot --nginx -d mcp.qgsm.store`
   - Or use aaPanel: add site mcp.qgsm.store, SSL, proxy to `127.0.0.1:3100`

6. Firewall:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

7. systemd (optional):
   ```bash
   sudo cp systemd/mcp-server.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable mcp-server
   sudo systemctl start mcp-server
   ```

## Deploy

```bash
./scripts/deploy.sh
```

(Assumes project at `/opt/mcp`, `.env` present, and systemd or docker compose.)

## MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Basic metrics |
| `/internal/chat` | POST | Admin LLM chat (Bearer + X-MCP-User-Id) |
| `/mcp` | GET/POST | MCP Streamable HTTP |

## Tools

| Tool | Description |
|------|-------------|
| `health` | Returns OK |
| `services_list` | List active services |
| `orders_create` | Create order (service_id, user_id, payload) |
| `orders_status` | Order status by id |
| `providers_quote` | Emulated provider quote (timeout + retry) |
| `admin_ai_chat` | Admin-only LLM chat (user_id must be in ADMIN_IDS) |

## Testing Tools (curl / Postman)

```bash
# Health
curl -H "Authorization: Bearer TOKEN" https://mcp.qgsm.store/health

# MCP initialize (JSON-RPC)
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  https://mcp.qgsm.store/mcp

# Admin chat
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "X-MCP-User-Id: YOUR_ADMIN_ID" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}' \
  https://mcp.qgsm.store/internal/chat
```

## Env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BEARER_TOKEN` | - | Required. Bearer token for auth |
| `ADMIN_IDS` | - | Comma-separated admin user IDs |
| `DATABASE_URL` | postgresql://mcp:...@localhost:5432/mcp_db | PostgreSQL URL |
| `REDIS_URL` | redis://localhost:6379 | Redis URL |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama API URL |
| `OLLAMA_MODEL` | deepseek-r1:1.5b | Model for CPU |
| `OPENAI_FALLBACK_ENABLED` | false | Enable OpenAI fallback |
| `OPENAI_API_KEY` | - | Required if fallback enabled |
| `RATE_LIMIT_IP_PER_MIN` | 60 | Per-IP limit |
| `RATE_LIMIT_USER_PER_DAY` | 200 | Per-user daily limit |

## Enable/Disable OpenAI Fallback

- Set `OPENAI_FALLBACK_ENABLED=true` and `OPENAI_API_KEY=sk-...` in `.env` to enable.
- Set `OPENAI_FALLBACK_ENABLED=false` or leave `OPENAI_API_KEY` empty to disable.
- When disabled, complex prompts will fail if Ollama fails.

## Cursor Integration

- **stdio**: Use `stdio-entry.js` as in `.cursor/mcp.json.example`.
- **HTTP**: Add `streamable-http` server with URL `https://mcp.qgsm.store` and `Authorization: Bearer TOKEN` header.

## Checks

- `curl -H "Authorization: Bearer TOKEN" http://localhost:3100/health` → `{"status":"ok",...}`
- `curl -H "Authorization: Bearer TOKEN" http://localhost:3100/metrics` → uptime, memory
- MCP client connects to `/mcp` and lists tools
- Audit logs show tool calls (no tokens)

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Missing/invalid Bearer | Set `Authorization: Bearer TOKEN` |
| 429 Too Many Requests | Rate limit | Wait or raise `RATE_LIMIT_*` |
| Ollama connection refused | Ollama not running | `docker compose up -d ollama` |
| OpenAI fallback fails | No API key | Set `OPENAI_API_KEY` and `OPENAI_FALLBACK_ENABLED=true` |
| .env in git | Accidentally committed | `git rm --cached .env`, add to .gitignore |

## Security

See [SECURITY.md](SECURITY.md) for token rotation, masking, and admin restrictions.
