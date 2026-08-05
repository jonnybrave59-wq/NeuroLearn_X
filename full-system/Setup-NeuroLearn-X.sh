#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python_command="${PYTHON:-python3}"
database="$root/backend/neurolearnx.db"
database_was_missing=0
[[ -f "$database" ]] || database_was_missing=1

if [[ ! -x "$root/.venv/bin/python" ]]; then
  "$python_command" -m venv "$root/.venv"
fi

python="$root/.venv/bin/python"
"$python" -m pip install --disable-pip-version-check -r "$root/backend/requirements.txt"
(
  cd "$root/backend"
  APP_ENV=development CREATE_TABLES_ON_STARTUP=0 "$python" -m alembic upgrade head
  if [[ "$database_was_missing" == "1" || "${SEED_DEMO:-0}" == "1" ]]; then
    APP_ENV=development CREATE_TABLES_ON_STARTUP=0 "$python" -m app.seed
  fi
)
echo "NeuroLearn-X setup completed. Run ./Start-NeuroLearn-X.sh."

