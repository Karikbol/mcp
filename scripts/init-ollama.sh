#!/bin/bash
# Run after: docker compose up -d ollama
# Pull CPU-friendly model for Oracle Always Free VPS
set -e
echo "Pulling deepseek-r1:1.5b (CPU-friendly)..."
docker compose exec ollama ollama pull deepseek-r1:1.5b
echo "Done. Model ready for MCP."
