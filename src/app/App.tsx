import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { SettingsState } from './types'
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
  type DisplayInfo,
} from './overlayBridge'
import { IslandRoot } from '../components/island/IslandRoot'
import { SettingsView } from '../components/settings/SettingsView'
import { loadClaudeStatusBridgePatch, loadLiveCurrentSession } from '../providers/claudeCodeSummary'
import { loadLiveUsageCostSnapshot } from '../providers/liveUsageCost'
import { useIslandStore } from '../stores/useIslandStore'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const currentWindowLabel = isTauriRuntime()
  ? getCurrentWindow().label
  : new URLSearchParams(window.location.search).get('window') ?? 'main'

export function App() {
  const store = useIslandStore()
  const [displays, setDisplays] = useState<DisplayInfo[]>([])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let cancelled = false
    const loadNativeState = async (): Promise<void> => {
      const [settings, nativeDisplays] = await Promise.all([loadAppSettings(), listDisplays()])
      if (cancelled) return

      if (settings) {
        store.patchSettings(settings)
        const displayId = typeof settings.targetDisplay === 'string' ? settings.targetDisplay : settings.targetDisplay.id
        void centerOverlayOnDisplay(displayId, settings.topOffsetPx)
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
      const currentSession = await loadLiveCurrentSession()
      if (!cancelled && currentSession) {
        store.setCurrentSession(currentSession)
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
      const currentSessionPatch = await loadClaudeStatusBridgePatch()
      if (!cancelled && currentSessionPatch) {
        store.patchCurrentSession(currentSessionPatch)
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

  const patchSettings = (settings: Partial<SettingsState>): void => {
    const nextSettings = { ...store.state.settings, ...settings }
    store.patchSettings(settings)
    void saveAppSettings(nextSettings)

    if (typeof settings.launchAtLogin === 'boolean') {
      void setLaunchAtLoginEnabled(settings.launchAtLogin)
    }

    if (typeof settings.fullscreenAvoidance === 'boolean') {
      void setFullscreenAvoidanceEnabled(settings.fullscreenAvoidance)
    }

    if ('targetDisplay' in settings || 'topOffsetPx' in settings) {
      const displayId = typeof nextSettings.targetDisplay === 'string' ? nextSettings.targetDisplay : nextSettings.targetDisplay.id
      void centerOverlayOnDisplay(displayId, nextSettings.topOffsetPx)
    }
  }

  const saveSettingsPatch = (settings: Partial<SettingsState>): void => {
    void saveAppSettings({ ...store.state.settings, ...settings })
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
          onToggleProvider={store.setProviderVisible}
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
        />
      </main>
    )
  }

  return (
    <IslandRoot
      state={store.state}
      onOpenSettings={() => void openSettingsWindow()}
      onToggleProvider={store.setProviderVisible}
    />
  )
}
