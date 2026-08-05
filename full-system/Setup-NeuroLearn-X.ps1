param(
    [switch]$SeedDemo
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot "backend"
$databasePath = Join-Path $backendRoot "neurolearnx.db"
$virtualEnvironment = Join-Path $projectRoot ".venv"
$python = Join-Path $virtualEnvironment "Scripts\python.exe"
$databaseWasMissing = -not (Test-Path -LiteralPath $databasePath)

if (-not (Test-Path -LiteralPath $python)) {
    $systemPython = Get-Command python -ErrorAction SilentlyContinue
    if (-not $systemPython) {
        throw "Python 3.11 or newer is required. Install Python, then run this setup again."
    }
    & $systemPython.Source -m venv $virtualEnvironment
}

& $python -m pip install --disable-pip-version-check -r (Join-Path $backendRoot "requirements.txt")

$env:APP_ENV = "development"
$env:CREATE_TABLES_ON_STARTUP = "0"
Push-Location $backendRoot
try {
    & $python -m alembic upgrade head
    if ($databaseWasMissing -or $SeedDemo) {
        & $python -m app.seed
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "NeuroLearn-X setup completed." -ForegroundColor Green
Write-Host "Run Start-NeuroLearn-X.bat to start the full system."

