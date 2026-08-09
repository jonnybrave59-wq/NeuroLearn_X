#!/usr/bin/env bash
set -euo pipefail

python /app/scripts/validate_deployment.py
python -m alembic upgrade head
python -m app.production_accounts
if [[ "${SEED_DEMO_IF_EMPTY:-0}" == "1" ]]; then
  python -m app.seed_if_empty
fi
if [[ "${SEED_DEMO_ON_STARTUP:-0}" == "1" ]]; then
  python -m app.seed
fi
exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-*}" \
  --limit-concurrency "${UVICORN_LIMIT_CONCURRENCY:-100}" \
  --timeout-keep-alive "${UVICORN_TIMEOUT_KEEP_ALIVE_SECONDS:-5}" \
  --timeout-graceful-shutdown "${UVICORN_GRACEFUL_SHUTDOWN_SECONDS:-30}"
