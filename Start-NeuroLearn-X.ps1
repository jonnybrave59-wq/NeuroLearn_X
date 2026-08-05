param(
    [int]$Port = 8021
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot "backend"
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
$openUrl = "http://127.0.0.1:$Port/#/"
$healthUrl = "http://127.0.0.1:$Port/api/health"

try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    if ($health.status -eq "ok" -and $health.service -eq "NeuroLearn-X API") {
        Start-Process $openUrl
        Write-Host "NeuroLearn-X is already running at $openUrl" -ForegroundColor Green
        exit 0
    }
}
catch {
    # No healthy server is listening yet; start the local full-stack system.
}

if (-not (Test-Path -LiteralPath $python)) {
    throw "The Python environment is missing. Run the setup instructions in README.md first."
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "frontend\dist\index.html"))) {
    throw "frontend/dist/index.html is missing. Run 'npm run build' inside frontend first."
}

$env:APP_ENV = "development"
$env:DATABASE_URL = "sqlite:///./neurolearnx.db"
$env:CREATE_TABLES_ON_STARTUP = "0"

Push-Location $backendRoot
try {
    & $python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed."
    }

    $openJob = Start-Job -ScriptBlock {
        param($HealthUrl, $OpenUrl)
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try {
                $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 1
                if ($health.status -eq "ok") {
                    Start-Process $OpenUrl
                    return
                }
            }
            catch {
                Start-Sleep -Milliseconds 500
            }
        }
    } -ArgumentList $healthUrl, $openUrl

    Write-Host "Starting the complete NeuroLearn-X system at $openUrl" -ForegroundColor Cyan
    Write-Host "Keep this window open while using the application." -ForegroundColor Yellow
    try {
        & $python -m uvicorn app.main:app --host 127.0.0.1 --port $Port --proxy-headers --forwarded-allow-ips="127.0.0.1"
    }
    finally {
        Remove-Job $openJob -Force -ErrorAction SilentlyContinue
    }
}
finally {
    Pop-Location
}
