$ErrorActionPreference = 'SilentlyContinue'

function Get-ClaudeHome {
  if ($env:CLAUDE_CONFIG_DIR) { return $env:CLAUDE_CONFIG_DIR }
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE '.claude') }
  if ($HOME) { return (Join-Path $HOME '.claude') }
  return $null
}

function Read-JsonFile($path) {
  try {
    if (-not (Test-Path $path)) { return $null }
    return Get-Content -Raw -Path $path -Encoding UTF8 | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Write-JsonFile($path, $value) {
  try {
    $value | ConvertTo-Json -Depth 100 | Set-Content -Path $path -Encoding UTF8
    return $true
  } catch {
    return $false
  }
}

function Command-IsClaudeHudOne($command) {
  if (-not $command) { return $false }
  $text = [string]$command
  return $text -like '*claude-status-bridge.mjs*' -or $text -like '*Claude HUD One*bridge*'
}

function Remove-ClaudeHudOneSettings {
  $claudeHome = Get-ClaudeHome
  if (-not $claudeHome) { return }

  $settingsPath = Join-Path $claudeHome 'settings.json'
  $settings = Read-JsonFile $settingsPath
  if (-not $settings) { return }

  try {
    $backupPath = "$settingsPath.bak-claude-hud-one-uninstall-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -Path $settingsPath -Destination $backupPath -Force
  } catch {}

  $changed = $false

  if ($settings.env -and ($settings.env.PSObject.Properties.Name -contains 'CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS')) {
    $settings.env.PSObject.Properties.Remove('CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS')
    $changed = $true
  }

  if ($settings.hooks) {
    foreach ($event in @($settings.hooks.PSObject.Properties.Name)) {
      $entries = @($settings.hooks.$event)
      $nextEntries = @()

      foreach ($entry in $entries) {
        $hooks = @($entry.hooks)
        $nextHooks = @($hooks | Where-Object { -not (Command-IsClaudeHudOne $_.command) })

        if ($nextHooks.Count -ne $hooks.Count) { $changed = $true }
        if ($nextHooks.Count -gt 0) {
          $entry.hooks = $nextHooks
          $nextEntries += $entry
        } else {
          $changed = $true
        }
      }

      if ($nextEntries.Count -gt 0) {
        $settings.hooks.$event = $nextEntries
      } else {
        $settings.hooks.PSObject.Properties.Remove($event)
      }
    }
  }

  $statusLineCommand = $settings.statusLine.command
  if (Command-IsClaudeHudOne $statusLineCommand) {
    $upstreamPath = if ($env:APPDATA) { Join-Path $env:APPDATA 'Claude HUD One\bridge\upstream-statusline.json' } else { $null }
    $upstream = if ($upstreamPath) { Read-JsonFile $upstreamPath } else { $null }
    $upstreamCommand = $upstream.command

    if ($upstreamCommand -and -not (Command-IsClaudeHudOne $upstreamCommand)) {
      $settings.statusLine = [PSCustomObject]@{
        type = 'command'
        command = [string]$upstreamCommand
      }
    } else {
      $settings.PSObject.Properties.Remove('statusLine')
    }
    $changed = $true
  }

  if ($changed) {
    Write-JsonFile $settingsPath $settings | Out-Null
  }
}

function Remove-ClaudeHudOneAppData {
  if ($env:APPDATA) {
    $appDataDir = Join-Path $env:APPDATA 'Claude HUD One'
    if (Test-Path $appDataDir) {
      Remove-Item -Path $appDataDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Remove-ClaudeHudOneRunKey {
  try {
    Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Claude HUD One' -Force -ErrorAction SilentlyContinue
  } catch {}
}

Remove-ClaudeHudOneSettings
Remove-ClaudeHudOneRunKey
Remove-ClaudeHudOneAppData
exit 0
