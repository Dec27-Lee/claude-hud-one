import { invoke } from '@tauri-apps/api/core'
import type { ClaudeCodeSummary, ClaudeStatusBridgeState, CurrentSessionState, ProviderLiveState, SessionActivityState } from '../app/types'

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

const resetLabel = (iso: string | null): string => {
  if (!iso) return 'Claude Code estimate'

  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return 'Claude Code estimate'

  const diffSeconds = Math.max(0, Math.round((timestamp - Date.now()) / 1000))
  if (diffSeconds < 60) return '<1m'

  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  return `${Math.round(diffHours / 24)}d`
}

const usagePercent = (value: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value / 100))
}

const compactTokens = (tokens: number | null | undefined): string | null => {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return null
  if (tokens < 1_000) return `${Math.round(tokens)} tokens`
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}K`
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}K`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

const emptyCounts = () => ({
  assistant: 0,
  user: 0,
  system: 0,
  attachment: 0,
  aiTitle: 0,
  mode: 0,
  permissionMode: 0,
  queueOperation: 0,
  fileHistorySnapshot: 0,
  lastPrompt: 0,
  other: 0,
})

const sessionKeyFromBridge = (bridge: ClaudeStatusBridgeState): string => {
  const fallback = [bridge.projectSlug, bridge.sessionName, bridge.projectDir ?? bridge.cwd].filter(Boolean).join(' · ')
  return (bridge.sessionKey ?? bridge.sessionId ?? bridge.transcriptPath ?? fallback) || bridge.updatedAt
}

const contextTokenLabelFromBridge = (bridge: ClaudeStatusBridgeState): string | null => {
  const explicit = compactTokens(bridge.contextUsedTokens)
  return explicit ? `${explicit} context` : null
}

const projectSlugFromBridge = (bridge: ClaudeStatusBridgeState): string => {
  const source = bridge.projectDir ?? bridge.cwd ?? bridge.projectSlug ?? bridge.sessionName ?? 'Claude Code'
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
  const context = contextTokenLabelFromBridge(bridge)
  return [source, model, context, bridge.statusText].filter(Boolean).join(' · ')
}

export const mapClaudeStatusBridgeToCurrentSessionPatch = (bridge: ClaudeStatusBridgeState): Partial<CurrentSessionState> => ({
  sessionKey: sessionKeyFromBridge(bridge),
  sessionId: bridge.sessionId,
  sessionName: bridge.sessionName,
  transcriptPath: bridge.transcriptPath,
  projectDir: bridge.projectDir ?? bridge.cwd,
  updatedAt: bridge.updatedAt,
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
  contextUsedTokens: bridge.contextUsedTokens,
  contextWindowSize: bridge.contextWindowSize,
  inputTokens: bridge.inputTokens,
  outputTokens: bridge.outputTokens,
  cacheCreationInputTokens: bridge.cacheCreationInputTokens,
  cacheReadInputTokens: bridge.cacheReadInputTokens,
  totalCostUsd: bridge.totalCostUsd,
  addedDirSlugs: bridge.addedDirSlugs,
  addedDirsOverflowCount: bridge.addedDirsOverflowCount,
  gitBranch: bridge.gitBranch,
  gitDirty: bridge.gitDirty,
  gitAhead: bridge.gitAhead,
  gitBehind: bridge.gitBehind,
  sessionStartedAt: bridge.sessionStartedAt,
  lastAssistantResponseAt: bridge.lastAssistantResponseAt,
  outputSpeed: bridge.outputSpeed,
  toolsCount: bridge.toolsCount,
  toolsRunningCount: bridge.toolsRunningCount,
  agentsCount: bridge.agentsCount,
  agentsRunningCount: bridge.agentsRunningCount,
  todosActiveCount: bridge.todosActiveCount,
  todosCompletedCount: bridge.todosCompletedCount,
  todosTotalCount: bridge.todosTotalCount,
  memoryUsedPercent: bridge.memoryUsedPercent,
  memoryUsedBytes: bridge.memoryUsedBytes,
  memoryTotalBytes: bridge.memoryTotalBytes,
  claudeMdCount: bridge.claudeMdCount,
  rulesCount: bridge.rulesCount,
  mcpCount: bridge.mcpCount,
  hooksCount: bridge.hooksCount,
})

export const mapClaudeStatusBridgeToCurrentSession = (bridge: ClaudeStatusBridgeState): CurrentSessionState => ({
  mode: 'live',
  activity: activityFromBridge(bridge),
  sourceLabel: sourceLabelFromBridge(bridge),
  projectSlug: projectSlugFromBridge(bridge),
  lastEventLabel: relativeTimeLabel(bridge.updatedAt),
  scannedAtLabel: relativeTimeLabel(bridge.updatedAt),
  transcriptCount: 0,
  totalEventCount: 0,
  assistantEventCount: 0,
  userEventCount: 0,
  toolCallRecordCount: 0,
  toolResultFileCount: 0,
  privacyNote: bridge.privacyNote,
  counts: emptyCounts(),
  bridgeStatusText: bridge.statusText,
  bridgeSource: bridge.source,
  bridgeHookEventName: bridge.hookEventName,
  activeToolName: bridge.toolName,
  modelLabel: bridge.modelName ?? bridge.modelId,
  contextUsedPercent: bridge.contextUsedPercent,
  contextUsedTokens: bridge.contextUsedTokens,
  contextWindowSize: bridge.contextWindowSize,
  inputTokens: bridge.inputTokens,
  outputTokens: bridge.outputTokens,
  cacheCreationInputTokens: bridge.cacheCreationInputTokens,
  cacheReadInputTokens: bridge.cacheReadInputTokens,
  totalCostUsd: bridge.totalCostUsd,
  addedDirSlugs: bridge.addedDirSlugs,
  addedDirsOverflowCount: bridge.addedDirsOverflowCount,
  gitBranch: bridge.gitBranch,
  gitDirty: bridge.gitDirty,
  gitAhead: bridge.gitAhead,
  gitBehind: bridge.gitBehind,
  sessionStartedAt: bridge.sessionStartedAt,
  lastAssistantResponseAt: bridge.lastAssistantResponseAt,
  outputSpeed: bridge.outputSpeed,
  toolsCount: bridge.toolsCount,
  toolsRunningCount: bridge.toolsRunningCount,
  agentsCount: bridge.agentsCount,
  agentsRunningCount: bridge.agentsRunningCount,
  todosActiveCount: bridge.todosActiveCount,
  todosCompletedCount: bridge.todosCompletedCount,
  todosTotalCount: bridge.todosTotalCount,
  memoryUsedPercent: bridge.memoryUsedPercent,
  memoryUsedBytes: bridge.memoryUsedBytes,
  memoryTotalBytes: bridge.memoryTotalBytes,
  claudeMdCount: bridge.claudeMdCount,
  rulesCount: bridge.rulesCount,
  mcpCount: bridge.mcpCount,
  hooksCount: bridge.hooksCount,
  sessionKey: sessionKeyFromBridge(bridge),
  sessionId: bridge.sessionId,
  sessionName: bridge.sessionName,
  transcriptPath: bridge.transcriptPath,
  projectDir: bridge.projectDir ?? bridge.cwd,
  updatedAt: bridge.updatedAt,
})

export const mapClaudeStatusBridgeToProviderPatch = (bridge: ClaudeStatusBridgeState): ProviderLiveState | null => {
  if (typeof bridge.fiveHourUsedPercent !== 'number' && typeof bridge.sevenDayUsedPercent !== 'number') return null

  return {
    fiveHour: {
      usedPercent: usagePercent(bridge.fiveHourUsedPercent),
      resetAtLabel: resetLabel(bridge.fiveHourResetAt),
    },
    weekly: {
      usedPercent: usagePercent(bridge.sevenDayUsedPercent),
      resetAtLabel: resetLabel(bridge.sevenDayResetAt),
    },
    stale: !bridgeIsFresh(bridge),
    lastUpdatedLabel: relativeTimeLabel(bridge.updatedAt),
    source: 'claudeCode',
    authStatus: 'ok',
  }
}

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
  sessionKey: `summary:${summary.projectSlug}`,
  updatedAt: summary.lastActivityAt ?? summary.scannedAt,
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

export const loadClaudeStatusBridgeState = async (): Promise<ClaudeStatusBridgeState | null> => {
  if (!isTauriRuntime()) return null

  try {
    return await invoke<ClaudeStatusBridgeState | null>('get_claude_status_bridge_state')
  } catch (error) {
    console.warn('Failed to load Claude Code status bridge state', error)
    return null
  }
}

export const loadClaudeStatusBridgeSessions = async (): Promise<ClaudeStatusBridgeState[]> => {
  if (!isTauriRuntime()) return []

  try {
    return await invoke<ClaudeStatusBridgeState[]>('get_claude_status_bridge_sessions')
  } catch (error) {
    console.warn('Failed to load Claude Code status bridge sessions', error)
    return []
  }
}

export const loadClaudeStatusBridgePatch = async (): Promise<Partial<CurrentSessionState> | null> => {
  const bridge = await loadClaudeStatusBridgeState()
  return bridge && bridgeIsFresh(bridge) ? mapClaudeStatusBridgeToCurrentSessionPatch(bridge) : null
}

export const loadLiveSessions = async (): Promise<CurrentSessionState[]> => {
  if (!isTauriRuntime()) return []

  try {
    const [summary, bridges] = await Promise.all([
      invoke<ClaudeCodeSummary>('get_claude_code_summary').catch(() => null),
      loadClaudeStatusBridgeSessions(),
    ])
    const bridgeSessions = bridges
      .filter(bridgeIsFresh)
      .map(mapClaudeStatusBridgeToCurrentSession)

    if (bridgeSessions.length > 0) return bridgeSessions
    return summary ? [mapClaudeCodeSummaryToCurrentSession(summary)] : []
  } catch (error) {
    console.warn('Failed to load Claude Code sessions', error)
    return []
  }
}

export const loadLiveCurrentSession = async (): Promise<CurrentSessionState | null> => {
  const sessions = await loadLiveSessions()
  return sessions[0] ?? null
}
