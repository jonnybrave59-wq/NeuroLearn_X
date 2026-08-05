param(
    [int]$Port = 8021,
    [string]$BindAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot "backend"
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Run Setup-NeuroLearn-X.bat before starting the application."
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "frontend\dist\index.html"))) {
    throw "The compiled PWA is missing. Extract the complete full-system ZIP again."
}

$env:APP_ENV = "development"
$env:CREATE_TABLES_ON_STARTUP = "0"
$openUrl = "http://127.0.0.1:$Port/#/"

Push-Location $backendRoot
try {
    & $python -m alembic upgrade head
    $openJob = Start-Job -ScriptBlock {
        param($Url)
        Start-Sleep -Seconds 2
        Start-Process $Url
    } -ArgumentList $openUrl
    try {
        & $python -m uvicorn app.main:app --host $BindAddress --port $Port --proxy-headers --forwarded-allow-ips="127.0.0.1"
    }
    finally {
        Remove-Job $openJob -Force -ErrorAction SilentlyContinue
    }
}
finally {
    Pop-Location
}

