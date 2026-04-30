# Verificare + copiere .env pentru setup local (Windows / PowerShell).
# Ruleaza din radacina monorepo-ului:  .\setup-local.ps1

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$envFile = Join-Path $root "api\.env"
$example = Join-Path $root "api\.env.example"

Write-Host ""
Write-Host "=== Fleet enterprise - verificare mediu ===" -ForegroundColor Cyan
Write-Host ""

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  Write-Host ('[OK] docker in PATH: ' + $docker.Source)
} else {
  Write-Host '[LIPSA] docker nu e in PATH.' -ForegroundColor Yellow
  Write-Host '        Instaleaza Docker Desktop (si reporni PC-ul) SAU Postgres nativ (vezi README, sectiunea Windows).' -ForegroundColor Yellow
}

try {
  $tnc = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue
  if ($tnc.TcpTestSucceeded) {
    Write-Host '[OK] Port 5432 deschis (Postgres probabil pornit).' -ForegroundColor Green
  } else {
    Write-Host '[LIPSA] Nimic nu asculta pe 127.0.0.1:5432.' -ForegroundColor Yellow
    Write-Host '        Porneste Postgres: din radacina proiectului ruleaza  docker compose up -d' -ForegroundColor Yellow
    Write-Host '        sau porneste serviciul Windows PostgreSQL dupa instalare.' -ForegroundColor Yellow
  }
} catch {
  Write-Host ('[?] Nu am putut testa portul 5432: ' + $_) -ForegroundColor Yellow
}

Write-Host ""
if (Test-Path $envFile) {
  Write-Host '[OK] api\.env exista deja.'
} elseif (Test-Path $example) {
  Copy-Item -LiteralPath $example -Destination $envFile
  Write-Host '[FIX] Am copiat api\.env.example -> api\.env' -ForegroundColor Green
} else {
  Write-Host '[EROARE] Lipseste api\.env.example. Recupereaza fisierul din repo.' -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Urmatorii pasi (PowerShell) ===" -ForegroundColor Cyan
Write-Host ('cd "' + $root + '\api"')
Write-Host "npm install"
Write-Host "npm run db:migrate"
Write-Host "npm run db:seed"
Write-Host "npm run start:dev"
Write-Host ""
