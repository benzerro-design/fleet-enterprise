@echo off
setlocal

if "%~1"=="" (
  echo Usage: restore-neon.cmd "postgresql://USER:PASS@HOST/neondb?sslmode=require" "backup.sql"
  exit /b 1
)

if "%~2"=="" (
  echo Usage: restore-neon.cmd "postgresql://USER:PASS@HOST/neondb?sslmode=require" "backup.sql"
  exit /b 1
)

set "DB_URL=%~1"
set "BACKUP_FILE=%~2"

if not exist "%BACKUP_FILE%" (
  echo Backup file not found: %BACKUP_FILE%
  exit /b 1
)

echo Restoring %BACKUP_FILE%...
psql "%DB_URL%" < "%BACKUP_FILE%"

if errorlevel 1 (
  echo Restore failed.
  exit /b 1
)

echo Restore completed.
endlocal
