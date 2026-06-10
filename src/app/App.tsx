import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { OverlayPosition, ProviderId, SettingsState } from './types'
import {
  centerOverlayOnDisplay,
  closeSettingsWindow,
  listDisplays,
  loadAppSettings,
  openDiagnosticsDir,
  openSettingsWindow,
  saveAppSettings,
  setFullscreenAvoidanceEnabled,
  setLaunchAtLoginEnabled,
  setOverlayPosition,
  type DisplayInfo,
} from './overlayBridge'
import { IslandRoot } from '../components/island/IslandRoot'
import { SettingsView } from '../components/settings/SettingsView'
import { loadClaudeStatusBridgeSessions, loadClaudeStatusBridgeState, loadLiveSessions, mapClaudeStatusBridgeToProviderPatch } from '../providers/claudeCodeSummary'
import { loadLiveUsageCostSnapshot } from '../providers/liveUsageCost'
import { useIslandStore } from '../stores/useIslandStore'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

type AppWindowLabel = 'main' | 'settings'

const validWindowLabel = (value: string | null | undefined): AppWindowLabel | null => {
  return value === 'settings' || value === 'main' ? value : null
}

const documentWindowLabel = (): AppWindowLabel | null => {
  if (typeof document === 'undefined') return null

  return validWindowLabel(document.querySelector<HTMLMetaElement>('meta[name="claude-hud-one-window"]')?.content)
}

const queryWindowLabel = (): AppWindowLabel | null => {
  if (typeof window === 'undefined') return null

  return validWindowLabel(new URLSearchParams(window.location.search).get('window'))
}

const pathWindowLabel = (): AppWindowLabel | null => {
  if (typeof window === 'undefined') return null

  return window.location.pathname.toLowerCase().endsWith('/settings.html') ? 'settings' : null
}

const resolveWindowLabel = (): AppWindowLabel => {
  const staticLabel = documentWindowLabel() ?? queryWindowLabel() ?? pathWindowLabel()
  if (staticLabel) return staticLabel

  if (isTauriRuntime()) {
    try {
      return getCurrentWindow().label === 'settings' ? 'settings' : 'main'
    } catch (error) {
      console.warn('Failed to resolve Tauri window label', error)
    }
  }

  return 'main'
}

export function App() {
  const store = useIslandStore()
  const [currentWindowLabel] = useState<AppWindowLabel>(() => resolveWindowLabel())
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!isTauriRuntime()) return

    let cancelled = false
    const loadNativeState = async (): Promise<void> => {
      const [settings, nativeDisplays] = await Promise.all([loadAppSettings(), listDisplays()])
      if (cancelled) return

      if (settings) {
        store.patchSettings(settings)
        if (settings.overlayPosition) {
          void setOverlayPosition(settings.overlayPosition)
        } else {
          const displayId = typeof settings.targetDisplay === 'string' ? settings.targetDisplay : settings.targetDisplay.id
          void centerOverlayOnDisplay(displayId, settings.topOffsetPx)
        }
      }
      setDisplays(nativeDisplays)
    }

    void loadNativeState()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime() || currentWindowLabel !== 'main') return

    let cancelled = false
    const refreshSession = async (): Promise<void> => {
      const sessions = await loadLiveSessions()
      if (!cancelled && sessions.length > 0) {
        store.setSessions(sessions)
      }
    }

    void refreshSession()
    const intervalId = window.setInterval(refreshSession, store.state.settings.lowPowerMode ? 15_000 : 5_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [store.state.settings.lowPowerMode])

  useEffect(() => {
    if (!isTauriRuntime() || currentWindowLabel !== 'main') return

    let cancelled = false
    const refreshStatusBridge = async (): Promise<void> => {
      const bridges = await loadClaudeStatusBridgeSessions()
      if (cancelled || bridges.length === 0) return

      const sessions = await loadLiveSessions()
      if (!cancelled && sessions.length > 0) {
        store.setSessions(sessions)
      }

      const claudeProviderPatch = mapClaudeStatusBridgeToProviderPatch(bridges[0])
      if (claudeProviderPatch) {
        store.applyClaudeProviderPatch(claudeProviderPatch)
      }
    }

    void refreshStatusBridge()
    const intervalId = window.setInterval(refreshStatusBridge, store.state.settings.lowPowerMode ? 5_000 : 1_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [store.state.settings.lowPowerMode])

  useEffect(() => {
    if (!isTauriRuntime() || currentWindowLabel !== 'main') return

    let cancelled = false
    const refreshUsageCost = async (): Promise<void> => {
      const snapshot = await loadLiveUsageCostSnapshot()
      if (!cancelled && snapshot) {
        store.applyLiveUsageCostSnapshot(snapshot)
      }
    }

    void refreshUsageCost()
    const intervalMs = store.state.settings.lowPowerMode
      ? Math.max(store.state.settings.refreshIntervalMinutes * 60_000, 15_000)
      : Math.max(store.state.settings.refreshIntervalMinutes * 60_000, 30_000)
    const intervalId = window.setInterval(refreshUsageCost, intervalMs)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [store.state.settings.lowPowerMode, store.state.settings.refreshIntervalMinutes])

  const refreshAll = async (): Promise<void> => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const [sessions, bridge, snapshot, nativeDisplays] = await Promise.all([
        loadLiveSessions(),
        loadClaudeStatusBridgeState(),
        loadLiveUsageCostSnapshot(),
        listDisplays(),
      ])

      if (sessions.length > 0) {
        store.setSessions(sessions)
      }

      if (bridge) {
        const claudeProviderPatch = mapClaudeStatusBridgeToProviderPatch(bridge)
        if (claudeProviderPatch) {
          store.applyClaudeProviderPatch(claudeProviderPatch)
        }
      }

      if (snapshot) {
        store.applyLiveUsageCostSnapshot(snapshot)
      }

      if (nativeDisplays.length > 0) {
        setDisplays(nativeDisplays)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const patchSettings = (settings: Partial<SettingsState>): void => {
    const placementChanged = 'targetDisplay' in settings || 'topOffsetPx' in settings
    const settingsPatch: Partial<SettingsState> = placementChanged ? { ...settings, overlayPosition: null } : settings
    const nextSettings = { ...store.state.settings, ...settingsPatch }
    store.patchSettings(settingsPatch)
    void saveAppSettings(nextSettings)

    if (typeof settings.launchAtLogin === 'boolean') {
      void setLaunchAtLoginEnabled(settings.launchAtLogin)
    }

    if (typeof settings.fullscreenAvoidance === 'boolean') {
      void setFullscreenAvoidanceEnabled(settings.fullscreenAvoidance)
    }

    if (placementChanged) {
      const displayId = typeof nextSettings.targetDisplay === 'string' ? nextSettings.targetDisplay : nextSettings.targetDisplay.id
      void centerOverlayOnDisplay(displayId, nextSettings.topOffsetPx)
    } else if ('overlayPosition' in settingsPatch) {
      if (nextSettings.overlayPosition) {
        void setOverlayPosition(nextSettings.overlayPosition)
      } else {
        const displayId = typeof nextSettings.targetDisplay === 'string' ? nextSettings.targetDisplay : nextSettings.targetDisplay.id
        void centerOverlayOnDisplay(displayId, nextSettings.topOffsetPx)
      }
    }
  }

  const saveOverlayPosition = (overlayPosition: OverlayPosition): void => {
    const nextSettings = { ...store.state.settings, overlayPosition }
    store.patchSettings({ overlayPosition })
    void saveAppSettings(nextSettings)
  }

  const saveSettingsPatch = (settings: Partial<SettingsState>): void => {
    void saveAppSettings({ ...store.state.settings, ...settings })
  }

  const toggleProviderVisible = (provider: ProviderId, visible: boolean): void => {
    const visibleProviders = { ...store.state.settings.visibleProviders, [provider]: visible }
    store.setProviderVisible(provider, visible)
    void saveAppSettings({ ...store.state.settings, visibleProviders })
  }

  if (currentWindowLabel === 'settings') {
    return (
      <main className="settings-app">
        <SettingsView
          state={store.state}
          displays={displays}
          onClose={() => void closeSettingsWindow()}
          onOpenDiagnostics={() => void openDiagnosticsDir('currentProject')}
          onPatchSettings={patchSettings}
          onToggleProvider={toggleProviderVisible}
          onSetChartStyle={(chartStyle) => {
            store.setChartStyle(chartStyle)
            saveSettingsPatch({ chartStyle })
          }}
          onSetCostStyle={(costStyle) => {
            store.setCostStyle(costStyle)
            saveSettingsPatch({ costStyle })
          }}
          onSetTokenCountMode={(tokenCountMode) => {
            store.setTokenCountMode(tokenCountMode)
            saveSettingsPatch({ tokenCountMode })
          }}
          onRefreshNow={() => void refreshAll()}
          isRefreshing={isRefreshing}
        />
      </main>
    )
  }

  return (
    <IslandRoot
      state={store.state}
      onOpenSettings={() => void openSettingsWindow()}
      onToggleProvider={toggleProviderVisible}
      onRefreshNow={() => void refreshAll()}
      isRefreshing={isRefreshing}
      onOverlayPositionChange={saveOverlayPosition}
    />
  )
}
