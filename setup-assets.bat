@echo off
setlocal
if not "%~1"=="" (
  echo BuilderDist is no longer required. The argument will be ignored.
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-assets.ps1"
if errorlevel 1 pause
