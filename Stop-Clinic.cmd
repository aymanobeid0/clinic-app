@echo off
cd /d "%~dp0"
node scripts/local-dev.ts --stop
if errorlevel 1 pause
