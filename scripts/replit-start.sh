#!/usr/bin/env bash
set -euo pipefail

bash scripts/replit-build.sh
exec bash scripts/replit-run.sh
