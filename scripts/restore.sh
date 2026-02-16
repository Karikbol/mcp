#!/usr/bin/env bash
# Restore Postgres for Telegram Bot Platform.
# Usage: ./scripts/restore.sh <backup_file.sql.gz>
# WARNING: Drops and recreates database. Use with caution.

set -e
BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  exit 1
fi

if [ -n "$DATABASE_URL" ]; then
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" -f - || true
else
  docker compose -f docker-compose.telegram.yml exec -T postgres \
    psql -U telegram_bot -d telegram_bot -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  gunzip -c "$BACKUP_FILE" | docker compose -f docker-compose.telegram.yml exec -T postgres \
    psql -U telegram_bot -d telegram_bot -f -
fi
echo "Restore completed. Re-run migrations if needed: docker compose -f docker-compose.telegram.yml run --rm telegram-bot node dist/db/migrate.js"
