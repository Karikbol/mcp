#!/bin/sh
set -e
node dist/db/migrate.js || true
exec node dist/index.js
