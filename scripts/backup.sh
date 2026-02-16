#!/usr/bin/env bash
# Backup Postgres for Telegram Bot Platform.
# Usage: ./scripts/backup.sh [backup_dir]
# Creates: backup_dir/telegram_bot_YYYYMMDD_HHMMSS.sql (default backup_dir=/backups)

set -e
BACKUP_DIR="${1:-./backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/telegram_bot_${STAMP}.sql"
mkdir -p "$BACKUP_DIR"

if [ -n "$DATABASE_URL" ]; then
  pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$FILE"
else
  # Default for docker-compose.telegram
  docker compose -f docker-compose.telegram.yml exec -T postgres \
    pg_dump -U telegram_bot telegram_bot --no-owner --no-acl > "$FILE"
fi
echo "Backup written: $FILE"
gzip -f "$FILE"
echo "Compressed: ${FILE}.gz"
