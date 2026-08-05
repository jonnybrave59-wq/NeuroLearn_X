$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"

Write-Host "NeuroLearn-X HTML App" -ForegroundColor Cyan
Write-Host "This launcher keeps the compiled HTML interface connected to the real backend and database."
Write-Host ""

if (-not (Test-Path -LiteralPath $python)) {
    Write-Host "First run: installing backend requirements and preparing the database..." -ForegroundColor Yellow
    & (Join-Path $projectRoot "Setup-NeuroLearn-X.ps1")
}

& (Join-Path $projectRoot "Start-NeuroLearn-X.ps1")
