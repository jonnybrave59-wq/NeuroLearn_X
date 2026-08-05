#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -x "$root/.venv/bin/python" ]]; then
  echo "First run: installing backend requirements and preparing the database..."
  "$root/Setup-NeuroLearn-X.sh"
fi
exec "$root/Start-NeuroLearn-X.sh"
