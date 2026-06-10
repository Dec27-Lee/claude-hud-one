import { useCallback, useEffect, useMemo, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import type { AlertState, ChartStyle, CostStyle, CurrentSessionState, IslandAppState, LiveUsageCostSnapshot, ProviderId, ProviderLiveState, SettingsState, TokenCountMode } from '../app/types'
import { displayedProviderOrder } from '../app/types'
import { createMockIslandState } from '../providers/mockData'
import { mergeDesktopHudConfig, mergeTerminalHudConfig } from '../hud/config'

export type IslandStore = {
  state: IslandAppState
  setProviderVisible: (provider: ProviderId, visible: boolean) => void
  setChartStyle: (style: ChartStyle) => void
  setCostStyle: (style: CostStyle) => void
  setTokenCountMode: (mode: TokenCountMode) => void
  setCurrentSession: (session: CurrentSessionState) => void
  setSessions: (sessions: CurrentSessionState[]) => void
  patchCurrentSession: (session: Partial<CurrentSessionState>) => void
  applyClaudeProviderPatch: (provider: ProviderLiveState) => void
  applyLiveUsageCostSnapshot: (snapshot: LiveUsageCostSnapshot) => void
  setAlerts: (alerts: AlertState) => void
  patchSettings: (settings: Partial<SettingsState>) => void
}

const STORAGE_KEY = 'claude-hud-one:island-state'
const STATE_EVENT = 'island-state-updated'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const deriveAlerts = (state: IslandAppState): AlertState => {
  if (!state.settings.alertsEnabled) return { severity: 'none' }

  const activeProviders = displayedProviderOrder
    .map((provider) => state.providers[provider])
    .filter((provider) => provider.visible && !provider.stale && !provider.fiveHour.error && !provider.weekly.error)

  const hottest = activeProviders
    .map((provider) => ({
      provider,
      percent: Math.round(Math.max(provider.fiveHour.usedPercent, provider.weekly.usedPercent) * 100),
    }))
    .sort((left, right) => right.percent - left.percent)[0]

  if (!hottest) return { severity: 'none' }
  if (hottest.percent >= state.settings.criticalThreshold) return { severity: 'critical', message: `${hottest.provider.name} usage ${hottest.percent}%` }
  if (hottest.percent >= state.settings.warningThreshold) return { severity: 'warning', message: `${hottest.provider.name} usage ${hottest.percent}%` }
  return { severity: 'none' }
}

const withDerivedAlerts = (state: IslandAppState): IslandAppState => ({ ...state, alerts: deriveAlerts(state) })

const claudeCodeWaitingProvider = (): ProviderLiveState => ({
  fiveHour: { usedPercent: 0, resetAtLabel: 'rate limits unavailable' },
  weekly: { usedPercent: 0, resetAtLabel: 'rate limits unavailable' },
  stale: true,
  lastUpdatedLabel: 'Waiting for Claude Code rate limits',
  source: 'claudeCode',
  authStatus: 'unknown',
})

export const mergeSettings = (base: SettingsState, patch?: Partial<SettingsState>): SettingsState => ({
  ...base,
  ...patch,
  visibleProviders: {
    ...base.visibleProviders,
    ...patch?.visibleProviders,
  },
  terminalHud: mergeTerminalHudConfig(base.terminalHud, patch?.terminalHud),
  desktopHud: mergeDesktopHudConfig(base.desktopHud, patch?.desktopHud),
})

const mergeState = (stored: Partial<IslandAppState>): IslandAppState => {
  const base = createMockIslandState()
  return withDerivedAlerts({
    ...base,
    ...stored,
    providers: { ...base.providers, ...stored.providers },
    cost: { ...base.cost, ...stored.cost },
    settings: mergeSettings(base.settings, stored.settings),
    currentSession: { ...base.currentSession, ...stored.currentSession },
    sessions: stored.sessions?.length ? stored.sessions : base.sessions,
    alerts: { ...base.alerts, ...stored.alerts },
  })
}

const loadPersistedState = (): IslandAppState => {
  if (typeof window === 'undefined') return createMockIslandState()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createMockIslandState()
    return mergeState(JSON.parse(stored) as Partial<IslandAppState>)
  } catch (error) {
    console.warn('Failed to load persisted island state', error)
    return createMockIslandState()
  }
}

const persistState = (state: IslandAppState): void => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent<IslandAppState>(STATE_EVENT, { detail: state }))
    if (isTauriRuntime()) {
      void emit(STATE_EVENT, state)
    }
  } catch (error) {
    console.warn('Failed to persist island state', error)
  }
}

export const useIslandStore = (): IslandStore => {
  const initialState = useMemo(() => loadPersistedState(), [])
  const [state, setState] = useState<IslandAppState>(initialState)

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY || !event.newValue) return

      try {
        setState(mergeState(JSON.parse(event.newValue) as Partial<IslandAppState>))
      } catch (error) {
        console.warn('Failed to apply persisted island state', error)
      }
    }

    const handleLocalUpdate = (event: Event): void => {
      const nextState = (event as CustomEvent<IslandAppState>).detail
      if (nextState) setState(nextState)
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(STATE_EVENT, handleLocalUpdate)

    let unlisten: (() => void) | undefined
    if (isTauriRuntime()) {
      void listen<IslandAppState>(STATE_EVENT, (event) => setState(event.payload)).then((unsubscribe) => {
        unlisten = unsubscribe
      }).catch((error) => console.warn('Failed to listen for island state updates', error))
    }

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(STATE_EVENT, handleLocalUpdate)
      unlisten?.()
    }
  }, [])

  const updateState = useCallback((updater: (current: IslandAppState) => IslandAppState): void => {
    setState((current) => {
      const nextState = updater(current)
      persistState(nextState)
      return nextState
    })
  }, [])

  return {
    state,
    setProviderVisible: (provider, visible) => {
      updateState((current) => withDerivedAlerts({
        ...current,
        providers: {
          ...current.providers,
          [provider]: {
            ...current.providers[provider],
            visible,
          },
        },
        settings: {
          ...current.settings,
          visibleProviders: {
            ...current.settings.visibleProviders,
            [provider]: visible,
          },
        },
      }))
    },
    setChartStyle: (chartStyle) => {
      updateState((current) => ({ ...current, settings: { ...current.settings, chartStyle } }))
    },
    setCostStyle: (costStyle) => {
      updateState((current) => ({ ...current, settings: { ...current.settings, costStyle } }))
    },
    setTokenCountMode: (tokenCountMode) => {
      updateState((current) => ({ ...current, settings: { ...current.settings, tokenCountMode } }))
    },
    setCurrentSession: (currentSession) => {
      updateState((current) => ({ ...current, currentSession, sessions: current.sessions.length > 0 ? current.sessions : [currentSession] }))
    },
    setSessions: (sessions) => {
      updateState((current) => {
        const nextSessions = sessions.length > 0 ? sessions : [current.currentSession]
        return { ...current, sessions: nextSessions, currentSession: nextSessions[0] ?? current.currentSession }
      })
    },
    patchCurrentSession: (currentSessionPatch) => {
      updateState((current) => {
        const currentSession = { ...current.currentSession, ...currentSessionPatch }
        const targetKey = currentSession.sessionKey ?? currentSession.sessionId ?? currentSession.transcriptPath
        const sessions = current.sessions.length > 0
          ? current.sessions.map((session, index) => {
              const key = session.sessionKey ?? session.sessionId ?? session.transcriptPath
              return key && targetKey && key === targetKey || (!targetKey && index === 0)
                ? { ...session, ...currentSessionPatch }
                : session
            })
          : [currentSession]
        return { ...current, currentSession, sessions }
      })
    },
    applyClaudeProviderPatch: (claudeProvider) => {
      updateState((current) => withDerivedAlerts({
        ...current,
        providers: {
          ...current.providers,
          claude: { ...current.providers.claude, ...claudeProvider },
        },
        lastUsageSyncLabel: `Claude Code estimate · ${claudeProvider.lastUpdatedLabel}`,
      }))
    },
    applyLiveUsageCostSnapshot: (snapshot) => {
      updateState((current) => {
        const useEndpointUsage = snapshot.claudeProvider.source === 'endpoint'
        const nextClaudeProvider = useEndpointUsage
          ? { ...current.providers.claude, ...snapshot.claudeProvider }
          : current.providers.claude.source === 'claudeCode' && !current.providers.claude.stale
            ? current.providers.claude
            : { ...current.providers.claude, ...claudeCodeWaitingProvider() }

        return withDerivedAlerts({
          ...current,
          providers: {
            ...current.providers,
            claude: nextClaudeProvider,
            codex: { ...current.providers.codex, ...snapshot.codexProvider },
          },
          cost: {
            claude: snapshot.claudeCost,
            codex: snapshot.codexCost,
          },
          dailyBuckets: snapshot.dailyBuckets.length > 0 ? snapshot.dailyBuckets : current.dailyBuckets,
          lastUsageSyncLabel: useEndpointUsage ? snapshot.lastUsageSyncLabel : nextClaudeProvider.lastUpdatedLabel,
          lastCostSyncLabel: snapshot.lastCostSyncLabel,
        })
      })
    },
    setAlerts: (alerts) => {
      updateState((current) => ({ ...current, alerts }))
    },
    patchSettings: (settings) => {
      updateState((current) => {
        const nextSettings = mergeSettings(current.settings, settings)
        const visibleProviders = settings.visibleProviders
        return withDerivedAlerts({
          ...current,
          settings: nextSettings,
          providers: visibleProviders
            ? {
                ...current.providers,
                claude: { ...current.providers.claude, visible: visibleProviders.claude },
                codex: { ...current.providers.codex, visible: visibleProviders.codex },
              }
            : current.providers,
        })
      })
    },
  }
}
