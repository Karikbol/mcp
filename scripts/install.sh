#!/usr/bin/env bash
# One-command installer (placeholder for future commercial distribution).
# Usage: ./scripts/install.sh
# Prompts for env, creates .env, runs docker compose, prints webhook command.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "Telegram Bot Platform — installer"
echo ""

if ! command -v docker &>/dev/null; then
  echo "Docker is required. Install Docker and try again." >&2
  exit 1
fi
if ! docker compose version &>/dev/null; then
  echo "Docker Compose is required. Install Docker Compose and try again." >&2
  exit 1
fi

ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  read -p ".env exists. Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipping .env. Run docker compose manually."
    exit 0
  fi
fi

read -p "BOT_TOKEN: " BOT_TOKEN
read -p "WEBAPP_BASE_URL [https://ybrjch.qgsm.store]: " WEBAPP_BASE_URL
WEBAPP_BASE_URL="${WEBAPP_BASE_URL:-https://ybrjch.qgsm.store}"
read -p "ADMIN_IDS (comma-separated Telegram IDs): " ADMIN_IDS
read -p "POSTGRES_PASSWORD [telegram_bot_password]: " POSTGRES_PASSWORD
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-telegram_bot_password}"

cat > "$ENV_FILE" << EOF
NODE_ENV=production
PORT=3000
BOT_TOKEN=$BOT_TOKEN
ADMIN_IDS=$ADMIN_IDS
WEBAPP_BASE_URL=$WEBAPP_BASE_URL
WEBHOOK_PATH=/telegram-webhook
DATABASE_URL=postgresql://telegram_bot:${POSTGRES_PASSWORD}@postgres:5432/telegram_bot
SESSION_TTL_MIN=15
RECOVERY_TOKEN_TTL_MIN=30
OTP_TTL_MIN=10
OTP_MAX_ATTEMPTS=2
OTP_MAX_SENDS=2
PIN_MAX_ATTEMPTS=3
RECOVERY_LOCK_HOURS=24
FLOOD_PROTECTION_ENABLED=false
FLOOD_HARD_BLOCK_ENABLED=false
FLOOD_WINDOW_SEC=2
FLOOD_MAX_EVENTS=5
FLOOD_BLOCK_MIN=30
SMS_PROVIDER=mock
EOF
echo "Wrote $ENV_FILE"

echo ""
echo "Starting containers..."
docker compose -f docker-compose.telegram.yml up -d --build

echo ""
echo "Set Telegram webhook (run this or set in BotFather):"
echo "  https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=${WEBAPP_BASE_URL}/telegram-webhook"
if [ -n "$BOT_TOKEN" ]; then
  read -p "Run setWebhook now? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBAPP_BASE_URL}/telegram-webhook" && echo "" || true
  fi
fi
echo ""
echo "Configure nginx: proxy / and /telegram-webhook to http://127.0.0.1:3000"
echo "Done."
