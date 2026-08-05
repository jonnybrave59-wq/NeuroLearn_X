@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-NeuroLearn-X.ps1"
if errorlevel 1 (
  echo.
  echo NeuroLearn-X could not start. Review the message above.
  pause
)
