# make-portable.ps1 — build a flash-drive-ready copy of the project.
#
#   pwsh ./scripts/make-portable.ps1            # source only (small; needs `pnpm install` on target)
#   pwsh ./scripts/make-portable.ps1 -Offline   # includes node_modules (Windows x64, runs offline)
#   pwsh ./scripts/make-portable.ps1 -Dest E:\sos-maintenance   # write straight to a drive
#
# Excludes regenerable output (.next, dist, coverage, var) and the real .env.
# Includes .git so the copy stays a working repo you can push from later.
param(
  [string]$Dest = 'C:\dev\sos-maintenance-portable',
  [switch]$Offline
)
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Write-Host '== make portable ==' -ForegroundColor Cyan
Write-Host "  source: $src"
Write-Host "  dest  : $Dest"

if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }

# robocopy is the robust large-tree copier on Windows.
$excludeDirs = @('node_modules', '.next', 'dist', 'coverage', 'var') |
  ForEach-Object { Join-Path $src $_ }
robocopy $src $Dest /E /NFL /NDL /NJH /NJS /NP `
  /XD @excludeDirs /XF '.env' '.env.prod' '*.tsbuildinfo' | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (code $LASTEXITCODE)" }
$global:LASTEXITCODE = 0
Write-Host '  copied source + docs + .git' -ForegroundColor Green

if ($Offline) {
  Write-Host '  installing dependencies (hoisted = copyable, for offline use)...' -ForegroundColor Cyan
  # Hoisted linker => a real flat node_modules with no symlinks, so it survives a
  # flash-drive copy and runs on another Windows x64 machine without internet.
  Set-Content -Path (Join-Path $Dest '.npmrc') -Value "node-linker=hoisted`nprefer-offline=true`n"
  Push-Location $Dest
  try {
    try { corepack enable | Out-Null } catch {}
    pnpm install
    pnpm exec prisma generate | Out-Null
  } finally { Pop-Location }
  Write-Host '  node_modules bundled (Windows x64)' -ForegroundColor Green
}

$mb = [math]::Round((Get-ChildItem $Dest -Recurse -File -Force |
  Measure-Object Length -Sum).Sum / 1MB)
Write-Host ''
Write-Host ("Portable copy ready: {0}  (~{1} MB)" -f $Dest, $mb) -ForegroundColor Green
Write-Host 'Copy this whole folder to your flash drive. See docs/PORTABLE_USB.md.' -ForegroundColor Cyan
if (-not $Offline) {
  Write-Host 'Tip: add -Offline to bundle node_modules so the target needs no internet.' -ForegroundColor DarkGray
}
