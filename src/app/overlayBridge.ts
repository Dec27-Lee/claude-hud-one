import { invoke } from '@tauri-apps/api/core'
import type { SettingsState } from './types'

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

export type UpdateState = {
  status: string
  currentVersion: string
  channel: string
  lastCheckedAt: string | null
  message: string
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
    return await invoke<DisplayInfo[]>('list_displays')
  } catch (error) {
    console.warn('Failed to list displays', error)
    return []
  }
}

export const centerOverlayOnDisplay = async (displayId: string | null, topOffsetPx: number): Promise<DisplayInfo | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<DisplayInfo>('center_overlay_on_display', {
      displayId: displayId === 'auto' ? null : displayId,
      topOffsetPx,
    })
  } catch (error) {
    console.warn('Failed to center overlay on display', error)
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
