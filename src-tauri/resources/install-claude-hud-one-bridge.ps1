$ErrorActionPreference = 'SilentlyContinue'

$HookEvents = @(
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'StopFailure',
  'PreCompact'
)

function Get-ClaudeHome {
  if ($env:CLAUDE_CONFIG_DIR) { return $env:CLAUDE_CONFIG_DIR }
  if ($env:USERPROFILE) { return (Join-Path $env:USERPROFILE '.claude') }
  if ($HOME) { return (Join-Path $HOME '.claude') }
  return $null
}

function Get-AppDataDir {
  if ($env:APPDATA) { return (Join-Path $env:APPDATA 'Claude HUD One') }
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
    $parent = Split-Path -Parent $path
    if ($parent -and -not (Test-Path $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $value | ConvertTo-Json -Depth 100 | Set-Content -Path $path -Encoding UTF8
    return $true
  } catch {
    return $false
  }
}

function Ensure-ObjectProperty($object, $name) {
  if (-not $object.PSObject.Properties[$name] -or $null -eq $object.$name -or $object.$name -isnot [pscustomobject]) {
    $object | Add-Member -MemberType NoteProperty -Name $name -Value ([pscustomobject]@{}) -Force
  }
  return $object.$name
}

function Command-IsClaudeHudOne($command) {
  if (-not $command) { return $false }
  $text = [string]$command
  return $text -like '*claude-status-bridge.mjs*' -or $text -like '*Claude HUD One*bridge*'
}

function Copy-BridgeScript($appDataDir) {
  $source = Join-Path $PSScriptRoot 'claude-status-bridge.mjs'
  $bridgeDir = Join-Path $appDataDir 'bridge'
  $bridgePath = Join-Path $bridgeDir 'claude-status-bridge.mjs'
  try {
    if (-not (Test-Path $bridgeDir)) { New-Item -ItemType Directory -Path $bridgeDir -Force | Out-Null }
    if (Test-Path $source) { Copy-Item -Path $source -Destination $bridgePath -Force }
  } catch {}
  return $bridgePath
}

function Save-UpstreamStatusLine($appDataDir, $command, $bridgeCommand) {
  if (-not $command) { return }
  if (Command-IsClaudeHudOne $command) { return }
  if ($command -eq $bridgeCommand) { return }
  try {
    $bridgeDir = Join-Path $appDataDir 'bridge'
    if (-not (Test-Path $bridgeDir)) { New-Item -ItemType Directory -Path $bridgeDir -Force | Out-Null }
    $path = Join-Path $bridgeDir 'upstream-statusline.json'
    [pscustomobject]@{
      command = $command
      savedBy = 'Claude HUD One'
    } | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
  } catch {}
}

function Hook-EntryContainsCommand($entry, $command) {
  foreach ($hook in @($entry.hooks)) {
    if ($hook.command -eq $command) { return $true }
  }
  return $false
}

function Ensure-HookEvent($hooksObject, $eventName, $hookCommand) {
  if (-not $hooksObject.PSObject.Properties[$eventName] -or $null -eq $hooksObject.$eventName) {
    $hooksObject | Add-Member -MemberType NoteProperty -Name $eventName -Value @() -Force
  }

  $entries = @($hooksObject.$eventName)
  foreach ($entry in $entries) {
    if (Hook-EntryContainsCommand $entry $hookCommand) { return }
  }

  $newEntry = [pscustomobject]@{
    matcher = ''
    hooks = @([pscustomobject]@{
      type = 'command'
      command = $hookCommand
      timeout = 2
    })
  }
  $hooksObject.$eventName = @($entries + $newEntry)
}

function Install-ClaudeHudOneBridge {
  $claudeHome = Get-ClaudeHome
  $appDataDir = Get-AppDataDir
  if (-not $claudeHome -or -not $appDataDir) { return }

  $settingsPath = Join-Path $claudeHome 'settings.json'
  $settings = Read-JsonFile $settingsPath
  if (-not $settings) { $settings = [pscustomobject]@{} }

  try {
    if (Test-Path $settingsPath) {
      $backupPath = "$settingsPath.bak-claude-hud-one-install-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
      Copy-Item -Path $settingsPath -Destination $backupPath -Force
    }
  } catch {}

  $bridgePath = Copy-BridgeScript $appDataDir
  $bridgeCommand = "node `"$bridgePath`""
  $hookCommand = "$bridgeCommand --hook"
  $previousStatusLine = $settings.statusLine.command

  Save-UpstreamStatusLine $appDataDir $previousStatusLine $bridgeCommand

  $settings | Add-Member -MemberType NoteProperty -Name statusLine -Value ([pscustomobject]@{
    type = 'command'
    command = $bridgeCommand
    padding = 0
    refreshInterval = 1
  }) -Force

  $hooksObject = Ensure-ObjectProperty $settings 'hooks'
  foreach ($eventName in $HookEvents) {
    Ensure-HookEvent $hooksObject $eventName $hookCommand
  }

  Write-JsonFile $settingsPath $settings | Out-Null
}

Install-ClaudeHudOneBridge
exit 0
