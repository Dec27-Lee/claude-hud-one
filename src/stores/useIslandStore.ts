import { useCallback, useEffect, useMemo, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import type { ChartStyle, CostStyle, CurrentSessionState, IslandAppState, LiveUsageCostSnapshot, ProviderId, SettingsState, TokenCountMode } from '../app/types'
import { createMockIslandState } from '../providers/mockData'

export type IslandStore = {
  state: IslandAppState
  setProviderVisible: (provider: ProviderId, visible: boolean) => void
  setChartStyle: (style: ChartStyle) => void
  setCostStyle: (style: CostStyle) => void
  setTokenCountMode: (mode: TokenCountMode) => void
  setCurrentSession: (session: CurrentSessionState) => void
  patchCurrentSession: (session: Partial<CurrentSessionState>) => void
  applyLiveUsageCostSnapshot: (snapshot: LiveUsageCostSnapshot) => void
  patchSettings: (settings: Partial<SettingsState>) => void
}

const STORAGE_KEY = 'claude-island-win:island-state'
const STATE_EVENT = 'island-state-updated'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const loadPersistedState = (): IslandAppState => {
  if (typeof window === 'undefined') return createMockIslandState()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createMockIslandState()
    return { ...createMockIslandState(), ...JSON.parse(stored) } as IslandAppState
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
        setState({ ...createMockIslandState(), ...JSON.parse(event.newValue) } as IslandAppState)
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
      updateState((current) => ({
        ...current,
        providers: {
          ...current.providers,
          [provider]: {
            ...current.providers[provider],
            visible,
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
    applyLiveUsageCostSnapshot: (snapshot) => {
      updateState((current) => ({
        ...current,
        providers: {
          ...current.providers,
          claude: { ...current.providers.claude, ...snapshot.claudeProvider },
          codex: { ...current.providers.codex, ...snapshot.codexProvider },
        },
        cost: {
          claude: snapshot.claudeCost,
          codex: snapshot.codexCost,
        },
        dailyBuckets: snapshot.dailyBuckets.length > 0 ? snapshot.dailyBuckets : current.dailyBuckets,
        lastUsageSyncLabel: snapshot.lastUsageSyncLabel,
        lastCostSyncLabel: snapshot.lastCostSyncLabel,
      }))
    },
    patchSettings: (settings) => {
      updateState((current) => ({ ...current, settings: { ...current.settings, ...settings } }))
    },
  }
}
