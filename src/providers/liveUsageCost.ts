import { invoke } from '@tauri-apps/api/core'
import type { LiveUsageCostSnapshot } from '../app/types'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const loadLiveUsageCostSnapshot = async (): Promise<LiveUsageCostSnapshot | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<LiveUsageCostSnapshot>('get_live_usage_cost_snapshot')
  } catch (error) {
    console.warn('Failed to load live usage/cost snapshot', error)
    return null
  }
}
