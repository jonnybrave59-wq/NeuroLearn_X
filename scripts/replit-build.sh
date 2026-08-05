#!/usr/bin/env bash
set -euo pipefail

python -m pip install --disable-pip-version-check -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
