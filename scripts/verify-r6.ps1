$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Script
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  & $Script
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

Invoke-Step "Version consistency" { npm run check:version }
Invoke-Step "Mobile HUD protocol" { npm run test:protocol }
Invoke-Step "Frontend build" { npm run build }
Invoke-Step "Rust check" { cargo check --manifest-path "src-tauri\Cargo.toml" -j 1 }
Invoke-Step "Rust usage/cost and mobile tests" { npm run test:rust }
Invoke-Step "Bridge tests" { npm run test:bridge }
Invoke-Step "Mobile security tests" { npm run test:security }
Invoke-Step "Android unit tests" { npm run test:android }
Invoke-Step "Android lint" { npm run lint:android }
Invoke-Step "Android fresh debug APK" { npm run build:android:fresh }
Invoke-Step "UI smoke screenshots" { npm run test:ui }
Invoke-Step "Tauri release build" { npm run tauri:build }

Write-Host "`nPhase R6 validation completed." -ForegroundColor Green
