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
Invoke-Step "Frontend build" { npm run build }
Invoke-Step "Rust check" { cargo check --manifest-path "src-tauri\Cargo.toml" -j 1 }
Invoke-Step "UI screenshots" { npm run test:ui }
Invoke-Step "Tauri release build" { npm run tauri:build }
Invoke-Step "Release exe smoke" {
  $exe = "src-tauri\target\release\claude-island-win.exe"
  if (-not (Test-Path $exe)) {
    throw "Release exe not found: $exe"
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
