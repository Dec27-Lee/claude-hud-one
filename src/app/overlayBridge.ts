import { invoke } from '@tauri-apps/api/core'
import type { OverlayPosition, SettingsState } from './types'

export type OverlayHitRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type FullscreenState = {
  hidden: boolean
  reason: string | null
}

export type DisplayInfo = {
  id: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

type RawDisplayInfo = Partial<DisplayInfo> & {
  id?: string
  name?: string
  work_area?: DisplayInfo['workArea']
  scale_factor?: number
  is_primary?: boolean
}

const emptyRect = { x: 0, y: 0, width: 0, height: 0 }

const normalizeDisplayInfo = (display: RawDisplayInfo, index: number): DisplayInfo => {
  const bounds = display.bounds ?? emptyRect
  const workArea = display.workArea ?? display.work_area ?? bounds

  return {
    id: display.id ?? display.name ?? `display-${index + 1}`,
    name: display.name ?? display.id ?? `Display ${index + 1}`,
    bounds,
    workArea,
    scaleFactor: display.scaleFactor ?? display.scale_factor ?? 1,
    isPrimary: display.isPrimary ?? display.is_primary ?? index === 0,
  }
}

export type UpdateState = {
  status: string
  currentVersion: string
  channel: string
  lastCheckedAt: string | null
  message: string
  configured: boolean
  canCheck: boolean
  downloadAvailable: boolean
  manualUpdateAvailable: boolean
  errorCode: string | null
  endpoint: string | null
  releasePageUrl: string | null
}

export type ClaudeGlobalBridgeStatus = {
  installed: boolean
  bridgePath: string | null
  settingsPath: string | null
  backupPath: string | null
  statusLineInstalled: boolean
  upstreamStatusLineSaved: boolean
  hookEventsInstalled: string[]
  message: string
  compatibilityMode: string
  statusLineOwner: string
  statusLineCommand: string | null
  enhancedCaptureEnabled: boolean
  hooksInstalled: boolean
  upstreamStatusLineCommand: string | null
  canRestoreStatusLine: boolean
}

export type DiagnosticsSummary = {
  appVersion: string
  appDataDir: string | null
  settingsPath: string | null
  settingsExists: boolean
  usageCachePath: string | null
  usageCacheExists: boolean
  claudeProjectsRoot: string | null
  claudeProjectsRootExists: boolean
  codexSessionsRoot: string | null
  codexSessionsRootExists: boolean
  privacyNote: string
}

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const updateOverlayHitRegions = async (regions: OverlayHitRegion[]): Promise<void> => {
  if (!isTauriRuntime()) return

  try {
    await invoke('update_overlay_hit_regions', { regions })
  } catch (error) {
    console.warn('Failed to update overlay hit regions', error)
  }
}

export const updateOverlayHitRegion = async (region: OverlayHitRegion): Promise<void> => {
  await updateOverlayHitRegions([region])
}

export const setOverlayClickThrough = async (enabled: boolean): Promise<void> => {
  if (!isTauriRuntime()) return

  try {
    await invoke('set_overlay_click_through', { enabled })
  } catch (error) {
    console.warn('Failed to update overlay click-through state', error)
  }
}

export const openSettingsWindow = async (): Promise<void> => {
  if (!isTauriRuntime()) return

  try {
    await invoke('open_settings_window')
  } catch (error) {
    console.warn('Failed to open settings window', error)
  }
}

export const closeSettingsWindow = async (): Promise<void> => {
  if (!isTauriRuntime()) return

  try {
    await invoke('close_settings_window')
  } catch (error) {
    console.warn('Failed to close settings window', error)
  }
}

export const setFullscreenAvoidanceEnabled = async (enabled: boolean): Promise<FullscreenState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<FullscreenState>('set_fullscreen_avoidance_enabled', { enabled })
  } catch (error) {
    console.warn('Failed to update fullscreen avoidance state', error)
    return null
  }
}

export const loadAppSettings = async (): Promise<SettingsState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<SettingsState>('load_app_settings')
  } catch (error) {
    console.warn('Failed to load native app settings', error)
    return null
  }
}

export const saveAppSettings = async (settings: SettingsState): Promise<SettingsState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<SettingsState>('save_app_settings', { settings })
  } catch (error) {
    console.warn('Failed to save native app settings', error)
    return null
  }
}

export const setLaunchAtLoginEnabled = async (enabled: boolean): Promise<boolean | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<boolean>('set_launch_at_login', { enabled })
  } catch (error) {
    console.warn('Failed to update launch-at-login state', error)
    return null
  }
}

export const openDiagnosticsDir = async (kind: 'root' | 'sessions' | 'projects' | 'currentProject' = 'currentProject'): Promise<string | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<string>('open_diagnostics_dir', { kind })
  } catch (error) {
    console.warn('Failed to open diagnostics directory', error)
    return null
  }
}

export const getDiagnosticsSummary = async (): Promise<DiagnosticsSummary | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<DiagnosticsSummary>('get_diagnostics_summary')
  } catch (error) {
    console.warn('Failed to get diagnostics summary', error)
    return null
  }
}

export const getClaudeGlobalBridgeStatus = async (): Promise<ClaudeGlobalBridgeStatus | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeGlobalBridgeStatus>('get_claude_global_bridge_status')
  } catch (error) {
    console.warn('Failed to get Claude global bridge status', error)
    return null
  }
}

export const ensureClaudeGlobalBridge = async (): Promise<ClaudeGlobalBridgeStatus | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeGlobalBridgeStatus>('ensure_claude_global_bridge')
  } catch (error) {
    console.warn('Failed to install Claude global bridge hooks', error)
    return null
  }
}

export const enableClaudeStatusLineBridge = async (): Promise<ClaudeGlobalBridgeStatus | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeGlobalBridgeStatus>('enable_claude_status_line_bridge')
  } catch (error) {
    console.warn('Failed to enable Claude statusLine bridge', error)
    return null
  }
}

export const restoreClaudeStatusLine = async (): Promise<ClaudeGlobalBridgeStatus | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeGlobalBridgeStatus>('restore_claude_status_line')
  } catch (error) {
    console.warn('Failed to restore Claude statusLine', error)
    return null
  }
}

export const removeClaudeGlobalBridgeHooks = async (): Promise<ClaudeGlobalBridgeStatus | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeGlobalBridgeStatus>('remove_claude_global_bridge_hooks')
  } catch (error) {
    console.warn('Failed to remove Claude global bridge hooks', error)
    return null
  }
}

export const openAppDataDir = async (): Promise<string | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<string>('open_app_data_dir')
  } catch (error) {
    console.warn('Failed to open app data directory', error)
    return null
  }
}

export const listDisplays = async (): Promise<DisplayInfo[]> => {
  if (!isTauriRuntime()) return []

  try {
    const displays = await invoke<RawDisplayInfo[]>('list_displays')
    return displays.map(normalizeDisplayInfo)
  } catch (error) {
    console.warn('Failed to list displays', error)
    return []
  }
}

export const centerOverlayOnDisplay = async (displayId: string | null, topOffsetPx: number): Promise<DisplayInfo | null> => {
  if (!isTauriRuntime()) return null

  try {
    const display = await invoke<RawDisplayInfo>('center_overlay_on_display', {
      displayId: displayId === 'auto' ? null : displayId,
      topOffsetPx,
    })
    return normalizeDisplayInfo(display, 0)
  } catch (error) {
    console.warn('Failed to center overlay on display', error)
    return null
  }
}

export const setOverlayPosition = async (position: OverlayPosition): Promise<OverlayPosition | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<OverlayPosition>('set_overlay_position', { position })
  } catch (error) {
    console.warn('Failed to set overlay position', error)
    return null
  }
}

export const getUpdateState = async (): Promise<UpdateState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<UpdateState>('get_update_state')
  } catch (error) {
    console.warn('Failed to get update state', error)
    return null
  }
}

export const checkForUpdates = async (): Promise<UpdateState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<UpdateState>('check_for_updates')
  } catch (error) {
    console.warn('Failed to check for updates', error)
    return null
  }
}

export const openReleasePage = async (): Promise<string | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<string>('open_release_page')
  } catch (error) {
    console.warn('Failed to open release page', error)
    return null
  }
}
