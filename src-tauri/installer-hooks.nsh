!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running Claude HUD One process..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name ''claude-hud-one'' -ErrorAction SilentlyContinue | Stop-Process -Force"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running Claude HUD One process..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name ''claude-hud-one'' -ErrorAction SilentlyContinue | Stop-Process -Force"'
  DetailPrint "Cleaning Claude HUD One user configuration..."
  IfFileExists "$INSTDIR\\resources\\cleanup-claude-hud-one.ps1" 0 +3
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\\resources\\cleanup-claude-hud-one.ps1"'
    Goto +2
  DetailPrint "Claude HUD One cleanup script not found; skipping user configuration cleanup."
!macroend
