#!/bin/bash
set -euo pipefail

# Production deploy script: git pull → build → restart
# Run from project root on VPS

echo "=== Deploy MCP Server ==="

# Ensure .env exists and is not in git
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy from .env.example and configure."
  exit 1
fi

# Validate no secrets in git
if git ls-files --error-unmatch .env 2>/dev/null; then
  echo "ERROR: .env must not be committed to git. Add to .gitignore."
  exit 1
fi

echo ">>> Git pull"
git pull origin main 2>/dev/null || git pull 2>/dev/null || true

echo ">>> Install deps"
npm ci --omit=dev

echo ">>> Run migrations"
npm run migrate

echo ">>> Build"
npm run build

echo ">>> Restart via systemd"
sudo systemctl restart mcp-server 2>/dev/null || {
  echo "Note: systemd not configured. Run: docker compose up -d --build"
  docker compose up -d --build
}

echo "=== Deploy done ==="
