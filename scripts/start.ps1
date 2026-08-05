$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
$listenHost = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$listenPort = if ($env:PORT) { [int]$env:PORT } else { 8021 }

if (-not (Test-Path -LiteralPath $python)) {
    throw "Create the virtual environment first. See README.md."
}

Push-Location (Join-Path $projectRoot "frontend")
npm run build
Pop-Location

Push-Location (Join-Path $projectRoot "backend")
& $python -m alembic upgrade head
& $python -m app.seed
& $python -m uvicorn app.main:app --host $listenHost --port $listenPort
Pop-Location
