$ErrorActionPreference = 'SilentlyContinue'

$HookEvents = @(
  'SessionStart',
  'UserPromptSubmit',
  'MessageDisplay',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PostToolBatch',
  'Notification',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'SessionEnd',
  'CwdChanged'
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
  # The old Node bridge pattern is recognized only for replacing legacy Claude settings.
  return $text -like '*claude-status-bridge.mjs*' -or $text -like '*hud-bridge*.exe*' -or $text -like '*Claude HUD One*bridge*'
}

function Copy-NativeBridgeFile($appDataDir) {
  $nativeSource = Join-Path $PSScriptRoot 'hud-bridge.exe'
  $bridgeDir = Join-Path $appDataDir 'bridge'
  $fallbackNativePath = Join-Path $bridgeDir 'hud-bridge.exe'
  if (-not (Test-Path $nativeSource)) {
    return [pscustomobject]@{ NativePath = $fallbackNativePath; HasNative = $false }
  }
  try {
    if (-not (Test-Path $bridgeDir)) { New-Item -ItemType Directory -Path $bridgeDir -Force -ErrorAction Stop | Out-Null }
  } catch {}

  $sourceHash = $null
  try { $sourceHash = (Get-FileHash $nativeSource -Algorithm SHA256 -ErrorAction Stop).Hash } catch {}
  $nativePath = $fallbackNativePath
  if ($sourceHash -and $sourceHash.Length -ge 12) {
    $nativePath = Join-Path $bridgeDir ("hud-bridge-{0}.exe" -f $sourceHash.Substring(0, 12).ToLowerInvariant())
  }

  for ($attempt = 0; $attempt -lt 3; $attempt++) {
    try {
      Copy-Item -Path $nativeSource -Destination $nativePath -Force -ErrorAction Stop
      $targetHash = $null
      try { $targetHash = (Get-FileHash $nativePath -Algorithm SHA256 -ErrorAction Stop).Hash } catch {}
      if (-not $sourceHash -or $sourceHash -eq $targetHash) { break }
    } catch {
      try { Remove-Item -Path $nativePath -Force -ErrorAction SilentlyContinue } catch {}
      Start-Sleep -Milliseconds 200
    }
  }

  try {
    Copy-Item -Path $nativeSource -Destination $fallbackNativePath -Force -ErrorAction SilentlyContinue
  } catch {}

  $hasNative = Test-Path $nativePath
  if ($hasNative -and $sourceHash) {
    try { $hasNative = ((Get-FileHash $nativePath -Algorithm SHA256 -ErrorAction Stop).Hash -eq $sourceHash) } catch { $hasNative = $false }
  }
  return [pscustomobject]@{
    NativePath = $nativePath
    HasNative = $hasNative
  }
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
    if ($hook.command -eq $command -or (Command-IsClaudeHudOne $hook.command)) { return $true }
  }
  return $false
}

function Ensure-HookEvent($hooksObject, $eventName, $hookCommand) {
  if (-not $hooksObject.PSObject.Properties[$eventName] -or $null -eq $hooksObject.$eventName) {
    $hooksObject | Add-Member -MemberType NoteProperty -Name $eventName -Value @() -Force
  }

  $entries = @($hooksObject.$eventName)
  $timeout = if ($eventName -eq 'PreToolUse') { 30 } else { 2 }
  foreach ($entry in $entries) {
    foreach ($hook in @($entry.hooks)) {
      if ($hook.command -eq $hookCommand -or (Command-IsClaudeHudOne $hook.command)) {
        $hook.command = $hookCommand
        $hook.timeout = $timeout
        return
      }
    }
  }

  $newEntry = [pscustomobject]@{
    matcher = ''
    hooks = @([pscustomobject]@{
      type = 'command'
      command = $hookCommand
      timeout = $timeout
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

  $bridgeFiles = Copy-NativeBridgeFile $appDataDir
  if (-not $bridgeFiles.HasNative) { return }
  $bridgeCommand = "`"$($bridgeFiles.NativePath)`""
  $hookCommand = "$bridgeCommand --hook"
  $previousStatusLine = $settings.statusLine.command
  $contextWindowSize = $null
  try {
    $contextWindowSize = [string]$settings.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE
    if ([string]::IsNullOrWhiteSpace($contextWindowSize)) { $contextWindowSize = [string]$settings.statusLine.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE }
    if ([string]::IsNullOrWhiteSpace($contextWindowSize)) { $contextWindowSize = $null }
  } catch {
    $contextWindowSize = $null
  }
  if ($contextWindowSize) {
    $envObject = Ensure-ObjectProperty $settings 'env'
    $envObject | Add-Member -MemberType NoteProperty -Name CLAUDE_HUD_CONTEXT_WINDOW_SIZE -Value $contextWindowSize -Force
  }

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
