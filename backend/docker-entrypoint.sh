#!/bin/sh
# Self-migrating start: wait for the DB, migrate, then serve. Safe to rerun on every restart.
set -e

echo "Running migrations..."
i=0
until alembic upgrade head; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after 30 attempts, giving up." >&2
    exit 1
  fi
  echo "Database not ready, retrying ($i/30)..."
  sleep 2
done

# Optional, idempotent seeding: a failure is logged but never stops the server.
python -m scripts.seed_admin || echo "seed_admin failed (non-fatal)"

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips "*"
