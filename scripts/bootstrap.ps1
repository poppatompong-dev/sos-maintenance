# bootstrap.ps1 — set up this repo on a fresh machine (Windows / PowerShell).
# Idempotent: safe to re-run. Does NOT touch git remotes or secrets.
#
#   pwsh ./scripts/bootstrap.ps1
#
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "== SOS maintenance bootstrap ==" -ForegroundColor Cyan

# 1. Node
if (-not (Have node)) {
  Write-Host "✗ Node not found. Install Node 22 LTS (see .nvmrc)." -ForegroundColor Red
  exit 1
}
$nodeMajor = (node -p "process.versions.node.split('.')[0]")
if ([int]$nodeMajor -lt 22) {
  Write-Host "! Node $nodeMajor detected; project targets Node 22+." -ForegroundColor Yellow
} else {
  Write-Host "✓ Node $(node -v)" -ForegroundColor Green
}

# 2. pnpm via corepack (uses the pinned packageManager version)
try { corepack enable | Out-Null } catch { Write-Host "! corepack enable failed (non-fatal)" -ForegroundColor Yellow }
if (-not (Have pnpm)) {
  Write-Host "✗ pnpm not found and corepack could not provide it." -ForegroundColor Red
  exit 1
}
Write-Host "✓ pnpm $(pnpm -v)" -ForegroundColor Green

# 3. Install dependencies
Write-Host "-- pnpm install --" -ForegroundColor Cyan
pnpm install

# 4. Prisma client
pnpm exec prisma generate | Out-Null
Write-Host "✓ Prisma client generated" -ForegroundColor Green

# 5. .env
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "✓ created .env from .env.example (dev placeholders)" -ForegroundColor Green
} else {
  Write-Host "✓ .env already present" -ForegroundColor Green
}

# 6. Docker services + DB (optional — only if Docker is available)
if (Have docker) {
  Write-Host "-- starting backing services (docker compose up -d) --" -ForegroundColor Cyan
  try {
    docker compose up -d
    Write-Host "  waiting for Postgres..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 6
    pnpm db:migrate
    pnpm db:postgis
    pnpm db:seed
    Write-Host "✓ database ready (migrated + PostGIS + 27 poles seeded)" -ForegroundColor Green
  } catch {
    Write-Host "! Docker step failed — start Docker Desktop and run: docker compose up -d; pnpm db:setup" -ForegroundColor Yellow
  }
} else {
  Write-Host "! Docker not found — install Docker Desktop, then: docker compose up -d; pnpm db:setup" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Start with:  pnpm dev   (and  pnpm worker:dev  in another terminal)" -ForegroundColor Cyan
