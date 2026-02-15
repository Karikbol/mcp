# Security

## Secrets

- **Never commit** `.env` or any file with `OPENAI_API_KEY`, `MCP_BEARER_TOKEN`, DB credentials.
- `.env` is in `.gitignore`. Copy from `.env.example` and fill values.

## Token rotation

1. Generate new token:
   ```bash
   openssl rand -hex 32
   ```
2. Update `MCP_BEARER_TOKEN` in `.env` on the server.
3. Restart the service.
4. Update all clients with the new token.
5. Revoke the old token (it remains valid until all clients switch).

## Masking in logs

- `config.ts` masks bearer token and API keys when logging.
- `logger.ts` serializers mask `Authorization`, `token`, `password`, `api_key` in request/body.
- `audit.ts` masks sensitive params in audit logs.

## admin.ai_chat

- Restricted by `ADMIN_IDS` (comma-separated Telegram user IDs).
- Client must send `user_id` in tool params or `X-MCP-User-Id` header (for internal/chat).
- Only users in `ADMIN_IDS` can use this tool.
