#!/usr/bin/env bash
set -euo pipefail

python scripts/validate_deployment.py

cd backend
python -m alembic upgrade head
if [[ "${SEED_DEMO_ON_STARTUP:-1}" == "1" ]]; then
  python -m app.seed
fi
exec python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="*"
