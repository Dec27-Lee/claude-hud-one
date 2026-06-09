import { useCallback, useEffect, useMemo, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import type { AlertState, ChartStyle, CostStyle, CurrentSessionState, IslandAppState, LiveUsageCostSnapshot, ProviderId, ProviderLiveState, SettingsState, TokenCountMode } from '../app/types'
import { displayedProviderOrder } from '../app/types'
import { createMockIslandState } from '../providers/mockData'

export type IslandStore = {
  state: IslandAppState
  setProviderVisible: (provider: ProviderId, visible: boolean) => void
  setChartStyle: (style: ChartStyle) => void
  setCostStyle: (style: CostStyle) => void
  setTokenCountMode: (mode: TokenCountMode) => void
  setCurrentSession: (session: CurrentSessionState) => void
  patchCurrentSession: (session: Partial<CurrentSessionState>) => void
  applyClaudeProviderPatch: (provider: ProviderLiveState) => void
  applyLiveUsageCostSnapshot: (snapshot: LiveUsageCostSnapshot) => void
  setAlerts: (alerts: AlertState) => void
  patchSettings: (settings: Partial<SettingsState>) => void
}

const STORAGE_KEY = 'claude-island-win:island-state'
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

const mergeState = (stored: Partial<IslandAppState>): IslandAppState => {
  const base = createMockIslandState()
  return withDerivedAlerts({
    ...base,
    ...stored,
    providers: { ...base.providers, ...stored.providers },
    cost: { ...base.cost, ...stored.cost },
    settings: { ...base.settings, ...stored.settings },
    currentSession: { ...base.currentSession, ...stored.currentSession },
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
      updateState((current) => ({ ...current, currentSession }))
    },
    patchCurrentSession: (currentSessionPatch) => {
      updateState((current) => ({ ...current, currentSession: { ...current.currentSession, ...currentSessionPatch } }))
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
        const preserveClaudeCodeEstimate = current.providers.claude.source === 'claudeCode'
        return withDerivedAlerts({
          ...current,
          providers: {
            ...current.providers,
            claude: preserveClaudeCodeEstimate
              ? {
                  ...current.providers.claude,
                  plan: current.providers.claude.plan ?? 'Claude Code',
                  accent: current.providers.claude.accent,
                  visible: current.providers.claude.visible,
                }
              : { ...current.providers.claude, ...snapshot.claudeProvider },
            codex: { ...current.providers.codex, ...snapshot.codexProvider },
          },
          cost: {
            claude: snapshot.claudeCost,
            codex: snapshot.codexCost,
          },
          dailyBuckets: snapshot.dailyBuckets.length > 0 ? snapshot.dailyBuckets : current.dailyBuckets,
          lastUsageSyncLabel: preserveClaudeCodeEstimate ? current.lastUsageSyncLabel : snapshot.lastUsageSyncLabel,
          lastCostSyncLabel: snapshot.lastCostSyncLabel,
        })
      })
    },
    setAlerts: (alerts) => {
      updateState((current) => ({ ...current, alerts }))
    },
    patchSettings: (settings) => {
      updateState((current) => {
        const nextSettings = { ...current.settings, ...settings }
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
