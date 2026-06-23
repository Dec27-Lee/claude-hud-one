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
Invoke-Step "Protocol contract" { npm run test:protocol }
Invoke-Step "Frontend build" { npm run build }
Invoke-Step "Rust check" { cargo check --manifest-path "src-tauri\Cargo.toml" -j 1 }
Invoke-Step "Rust usage/cost tests" { npm run test:rust }
Invoke-Step "Bridge tests" { npm run test:bridge }
Invoke-Step "Mobile security tests" { npm run test:security }
Invoke-Step "Native bridge build" { npm run build:bridge }
Invoke-Step "UI screenshots" { npm run test:ui }
Invoke-Step "Tauri release build" { npm run tauri:build }
Invoke-Step "Installer artifacts" {
  $artifacts = @(Get-ChildItem "src-tauri\target\release\bundle\nsis\Claude HUD One_*_x64-setup.exe" -ErrorAction SilentlyContinue)
  if ($artifacts.Count -lt 1) {
    throw "Installer artifact not found under src-tauri\target\release\bundle\nsis."
  }

  foreach ($item in $artifacts) {
    $artifact = $item.FullName
    if ($item.Length -le 0) {
      throw "Installer artifact is empty: $artifact"
    }

    $hash = Get-FileHash -Algorithm SHA256 -Path $artifact
    Write-Host "$artifact SHA256 $($hash.Hash)" -ForegroundColor Green
  }
}
Invoke-Step "Release exe smoke" {
  $exe = "src-tauri\target\release\claude-hud-one.exe"
  if (-not (Test-Path $exe)) {
    throw "Release exe not found: $exe"
  }

  try {
    Get-Process -Name "claude-hud-one" -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false
    Start-Sleep -Milliseconds 500
  } catch {
    Write-Host "Could not stop existing claude-hud-one processes: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  $process = Start-Process -FilePath $exe -PassThru
  Start-Sleep -Seconds 8
  if ($process.HasExited) {
    throw "Release exe exited early with code $($process.ExitCode)"
  }

  Stop-Process -Id $process.Id -Force -Confirm:$false
  Write-Host "Release exe stayed alive for 8 seconds. PID $($process.Id) stopped." -ForegroundColor Green
}

Write-Host "`nSmoke validation completed." -ForegroundColor Green
