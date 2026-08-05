#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python="$root/.venv/bin/python"
port="${PORT:-8021}"
bind_address="${HOST:-127.0.0.1}"

if [[ ! -x "$python" ]]; then
  echo "Run ./Setup-NeuroLearn-X.sh before starting the application." >&2
  exit 1
fi

cd "$root/backend"
APP_ENV=development CREATE_TABLES_ON_STARTUP=0 "$python" -m alembic upgrade head
(
  sleep 2
  url="http://127.0.0.1:${port}/#/"
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true; fi
  if command -v open >/dev/null 2>&1; then open "$url" >/dev/null 2>&1 || true; fi
) &
exec env APP_ENV=development CREATE_TABLES_ON_STARTUP=0 "$python" -m uvicorn app.main:app --host "$bind_address" --port "$port" --proxy-headers --forwarded-allow-ips="127.0.0.1"

