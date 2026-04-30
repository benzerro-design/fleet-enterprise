@echo off
setlocal

if "%~1"=="" (
  echo Usage: backup-neon.cmd "postgresql://USER:PASS@HOST/neondb?sslmode=require"
  exit /b 1
)

set "DB_URL=%~1"
set "TS=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"
set "OUT=backup-neon-%TS%.sql"

echo Creating backup in %OUT%...
pg_dump --format=plain --no-owner --no-privileges "%DB_URL%" > "%OUT%"

if errorlevel 1 (
  echo Backup failed.
  exit /b 1
)

echo Backup created: %OUT%
endlocal
