#requires -Version 5
# ─────────────────────────────────────────────────────────────────────────────
# dev-autosync.ps1 — TỰ ĐỒNG BỘ HMI localhost với nhánh trên GitHub.
#   Cứ mỗi lần có commit mới trên nhánh → tự pull + build plugin + bundle server
#   + restart server. Chạy MỘT LẦN rồi để yên; F5 trình duyệt để thấy sơ đồ mới.
#
#   Thermal HMI : http://localhost:8080
#   Fleet view  : http://localhost:8080/fleet
#
#   Cách chạy (PowerShell, tại thư mục gốc repo):
#     powershell -ExecutionPolicy Bypass -File scripts\dev-autosync.ps1
#   Hoặc bấm đúp scripts\dev-autosync.bat
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = 'Stop'

$Branch   = 'claude/doc-analysis-lna6sz'   # nhánh đang phát triển
$Port     = 8080                            # cổng thermal HMI
$PollSec  = 10                              # nhịp canh commit mới (giây)
$Root     = Split-Path -Parent $PSScriptRoot   # repo root (script nằm trong scripts/)
$AppDir   = Join-Path $Root 'apps\thermal-runtime'
Set-Location $Root

function Log($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

$global:Server = $null

function Stop-Server {
  if ($global:Server -and -not $global:Server.HasExited) {
    try { Stop-Process -Id $global:Server.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  # dọn mọi tiến trình còn giữ cổng (phòng khi lần trước treo)
  try {
    $pids = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess |
            Select-Object -Unique
    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
  } catch {}
}

function Build-And-Serve {
  Log 'Build plugin thermal…'
  pnpm --filter '@idtp/plugin-thermal-power-600' build | Out-Null
  Log 'Bundle server…'
  Push-Location $AppDir
  try { pnpm bundle | Out-Null } finally { Pop-Location }
  Stop-Server
  Log "Khởi động server → http://localhost:$Port"
  $global:Server = Start-Process -FilePath 'node' -ArgumentList 'dist/server.mjs' `
                     -WorkingDirectory $AppDir -PassThru -WindowStyle Hidden
}

# ── Khởi tạo ─────────────────────────────────────────────────────────────────
Log "Repo : $Root"
Log "Nhánh: $Branch"

$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $Branch) {
  Log "Chuyển sang nhánh $Branch…"
  git fetch --quiet origin $Branch 2>$null
  git checkout $Branch 2>$null
  if ($LASTEXITCODE -ne 0) { git checkout -B $Branch "origin/$Branch" | Out-Null }
}
if (-not (Test-Path (Join-Path $Root 'node_modules'))) { Log 'pnpm install…'; pnpm install | Out-Null }

Build-And-Serve
$last = (git rev-parse HEAD).Trim()
Log "ĐANG CANH thay đổi mỗi $PollSec giây. Nhấn Ctrl+C để dừng."

# ── Vòng canh ────────────────────────────────────────────────────────────────
while ($true) {
  Start-Sleep -Seconds $PollSec
  git fetch --quiet origin $Branch 2>$null
  $remote = (git rev-parse "origin/$Branch" 2>$null)
  if (-not $remote) { continue }
  $remote = $remote.Trim()
  if ($remote -eq $last) { continue }

  Log 'Phát hiện commit mới → cập nhật…'
  git pull --ff-only origin $Branch | Out-Null
  if ($LASTEXITCODE -ne 0) { Log 'Pull không fast-forward được (nhánh phân kỳ) — bỏ qua.'; continue }

  $changed = git diff --name-only $last HEAD
  if ($changed -match 'pnpm-lock\.yaml|package\.json') { Log 'Dependencies đổi → pnpm install…'; pnpm install | Out-Null }

  Build-And-Serve
  $last = (git rev-parse HEAD).Trim()
  Log '✅ ĐÃ CẬP NHẬT XONG — F5 lại trình duyệt để tải sơ đồ mới.'
}
