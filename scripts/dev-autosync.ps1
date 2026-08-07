#requires -Version 5
# =============================================================================
# dev-autosync.ps1 - Auto-sync local HMI with the GitHub branch.
#   Every time a new commit lands on the branch: pull + build plugin +
#   bundle server + restart node. Run ONCE and leave it open.
#   Press F5 in the browser after you see "UPDATED".
#
#   Thermal HMI : http://localhost:8080
#   Fleet view  : http://localhost:8080/fleet
#
#   How to run (PowerShell, at repo root):
#     powershell -ExecutionPolicy Bypass -File scripts\dev-autosync.ps1
#   Or double-click scripts\dev-autosync.bat
# =============================================================================
$ErrorActionPreference = 'Stop'

$Branch  = 'claude/doc-analysis-lna6sz'          # dev branch
$Port    = 8080                                   # thermal HMI port
$PollSec = 10                                      # poll interval (seconds)
$Root    = Split-Path -Parent $PSScriptRoot        # repo root (script is in scripts/)
$AppDir  = Join-Path $Root 'apps\thermal-runtime'
Set-Location $Root

function Log($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

$global:Server = $null

function Stop-Server {
  if ($global:Server -and -not $global:Server.HasExited) {
    try { Stop-Process -Id $global:Server.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  # free the port in case a previous process is stuck holding it
  try {
    $pids = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
  } catch {}
}

function Build-And-Serve {
  Log 'Building thermal plugin...'
  pnpm --filter '@idtp/plugin-thermal-power-600' build | Out-Null
  Log 'Bundling server...'
  Push-Location $AppDir
  try { pnpm bundle | Out-Null } finally { Pop-Location }
  Stop-Server
  Log ("Starting server -> http://localhost:{0}" -f $Port)
  $psi = @{
    FilePath         = 'node'
    ArgumentList     = 'dist/server.mjs'
    WorkingDirectory = $AppDir
    PassThru         = $true
    WindowStyle      = 'Hidden'
  }
  $global:Server = Start-Process @psi
}

# ---- Init -------------------------------------------------------------------
Log ("Repo   : {0}" -f $Root)
Log ("Branch : {0}" -f $Branch)

$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $Branch) {
  Log ("Switching to branch {0}..." -f $Branch)
  git fetch --quiet origin $Branch 2>$null
  git checkout $Branch 2>$null
  if ($LASTEXITCODE -ne 0) { git checkout -B $Branch ("origin/{0}" -f $Branch) | Out-Null }
}
if (-not (Test-Path (Join-Path $Root 'node_modules'))) { Log 'pnpm install...'; pnpm install | Out-Null }

Build-And-Serve
$last = (git rev-parse HEAD).Trim()
Log ("Watching for changes every {0}s. Press Ctrl+C to stop." -f $PollSec)

# ---- Watch loop -------------------------------------------------------------
while ($true) {
  Start-Sleep -Seconds $PollSec
  git fetch --quiet origin $Branch 2>$null
  $remote = (git rev-parse ("origin/{0}" -f $Branch) 2>$null)
  if (-not $remote) { continue }
  $remote = $remote.Trim()
  if ($remote -eq $last) { continue }

  Log 'New commit detected -> updating...'
  git pull --ff-only origin $Branch | Out-Null
  if ($LASTEXITCODE -ne 0) { Log 'Pull is not fast-forward (branch diverged) - skipping.'; continue }

  $changed = git diff --name-only $last HEAD
  if ($changed -match 'pnpm-lock\.yaml|package\.json') { Log 'Dependencies changed -> pnpm install...'; pnpm install | Out-Null }

  Build-And-Serve
  $last = (git rev-parse HEAD).Trim()
  Log '=== UPDATED === Press F5 in the browser to load the new mimic.'
}
