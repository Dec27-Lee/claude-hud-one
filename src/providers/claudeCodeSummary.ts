import { invoke } from '@tauri-apps/api/core'
import type { ClaudeCodeSummary, ClaudeStatusBridgeState, CurrentSessionState, SessionActivityState } from '../app/types'

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const relativeTimeLabel = (isoOrMillis: string | null): string => {
  if (!isoOrMillis) return 'no recent activity'

  const numericMillis = Number(isoOrMillis)
  const timestamp = Number.isFinite(numericMillis) ? numericMillis : Date.parse(isoOrMillis)
  if (!Number.isFinite(timestamp)) return 'recently updated'

  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`

  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return `${Math.round(diffHours / 24)}d ago`
}

const projectSlugFromBridge = (bridge: ClaudeStatusBridgeState): string => {
  if (bridge.projectSlug) return bridge.projectSlug
  const source = bridge.projectDir ?? bridge.cwd ?? bridge.sessionName ?? 'Claude Code'
  return source.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? 'Claude Code'
}

const bridgeIsFresh = (bridge: ClaudeStatusBridgeState): boolean => {
  const timestamp = Date.parse(bridge.updatedAt)
  return Number.isFinite(timestamp) && Date.now() - timestamp < 10 * 60_000
}

const activityFromBridge = (bridge: ClaudeStatusBridgeState): SessionActivityState => {
  if (!bridgeIsFresh(bridge)) return 'idle'
  return bridge.activity
}

const sourceLabelFromBridge = (bridge: ClaudeStatusBridgeState): string => {
  const source = bridge.source === 'hook' ? 'Claude Code hook bridge' : 'Claude Code statusLine bridge'
  const model = bridge.modelName ?? bridge.modelId
  const context = typeof bridge.contextUsedPercent === 'number' ? `ctx ${Math.round(bridge.contextUsedPercent)}%` : null
  return [source, model, context, bridge.statusText].filter(Boolean).join(' · ')
}

export const mapClaudeStatusBridgeToCurrentSessionPatch = (bridge: ClaudeStatusBridgeState): Partial<CurrentSessionState> => ({
  mode: 'live',
  activity: activityFromBridge(bridge),
  sourceLabel: sourceLabelFromBridge(bridge),
  projectSlug: projectSlugFromBridge(bridge),
  lastEventLabel: relativeTimeLabel(bridge.updatedAt),
  scannedAtLabel: relativeTimeLabel(bridge.updatedAt),
  privacyNote: bridge.privacyNote,
  bridgeStatusText: bridge.statusText,
  bridgeSource: bridge.source,
  bridgeHookEventName: bridge.hookEventName,
  activeToolName: bridge.toolName,
  modelLabel: bridge.modelName ?? bridge.modelId,
  contextUsedPercent: bridge.contextUsedPercent,
  totalCostUsd: bridge.totalCostUsd,
})

const activityFromSummary = (summary: ClaudeCodeSummary): SessionActivityState => {
  if (!summary.lastActivityAt) return 'idle'

  const timestamp = Date.parse(summary.lastActivityAt)
  if (!Number.isFinite(timestamp)) return 'active'

  const ageSeconds = (Date.now() - timestamp) / 1000
  if (ageSeconds < 90) return 'running'
  if (ageSeconds < 600) return 'active'
  return 'idle'
}

export const mapClaudeCodeSummaryToCurrentSession = (summary: ClaudeCodeSummary): CurrentSessionState => ({
  mode: summary.mode,
  activity: activityFromSummary(summary),
  sourceLabel: summary.projectSource,
  projectSlug: summary.projectSlug,
  lastEventLabel: relativeTimeLabel(summary.lastActivityAt),
  scannedAtLabel: relativeTimeLabel(summary.scannedAt),
  transcriptCount: summary.transcriptCount,
  totalEventCount: summary.totalEvents,
  assistantEventCount: summary.counts.assistant,
  userEventCount: summary.counts.user,
  toolCallRecordCount: summary.toolCallRecordCount,
  toolResultFileCount: summary.toolResultFileCount,
  privacyNote: summary.privacyNote,
  counts: summary.counts,
})

export const loadClaudeStatusBridgePatch = async (): Promise<Partial<CurrentSessionState> | null> => {
  if (!isTauriRuntime()) return null

  try {
    const bridge = await invoke<ClaudeStatusBridgeState | null>('get_claude_status_bridge_state')
    return bridge && bridgeIsFresh(bridge) ? mapClaudeStatusBridgeToCurrentSessionPatch(bridge) : null
  } catch (error) {
    console.warn('Failed to load Claude Code status bridge state', error)
    return null
  }
}

export const loadLiveCurrentSession = async (): Promise<CurrentSessionState | null> => {
  if (!isTauriRuntime()) return null

  try {
    const [summary, bridge] = await Promise.all([
      invoke<ClaudeCodeSummary>('get_claude_code_summary'),
      invoke<ClaudeStatusBridgeState | null>('get_claude_status_bridge_state').catch(() => null),
    ])
    const currentSession = mapClaudeCodeSummaryToCurrentSession(summary)
    return bridge && bridgeIsFresh(bridge)
      ? { ...currentSession, ...mapClaudeStatusBridgeToCurrentSessionPatch(bridge) }
      : currentSession
  } catch (error) {
    console.warn('Failed to load Claude Code session summary', error)
    return null
  }
}
