import type { DesktopHudConfig, TerminalHudConfig } from '../hud/config'

export type ProviderId = 'claude' | 'codex'
export type IslandViewState = 'compact' | 'peek' | 'expanded'
export type IslandPage = 'usage' | 'cost' | 'overview'
export type ChartStyle = 'ring' | 'bar' | 'stepped' | 'numeric' | 'sparkline'
export type CostStyle = 'usd' | 'value' | 'tokens' | 'trend'
export type TokenCountMode = 'all' | 'billable'
export type AppLanguage = 'auto' | 'en' | 'zh-CN'
export type TargetDisplay = 'auto' | 'primary' | { id: string; label: string }
export type OverlayPosition = { x: number; y: number }
export type SessionMode = 'mock' | 'live'
export type SessionActivityState = 'idle' | 'active' | 'running' | 'waiting' | 'error'
export type ProviderSource = 'mock' | 'localEstimate' | 'claudeCode' | 'endpoint' | 'cache'
export type ProviderAuthStatus = 'unknown' | 'missing' | 'ok' | 'expired' | 'scopeRequired' | 'notConfigured'

export type WindowUsageState = {
  usedPercent: number
  resetAtLabel: string
  error?: string
}

export type ProviderState = {
  id: ProviderId
  name: string
  accent: string
  visible: boolean
  plan?: string
  fiveHour: WindowUsageState
  weekly: WindowUsageState
  stale: boolean
  lastUpdatedLabel: string
  source?: ProviderSource
  authStatus?: ProviderAuthStatus
}

export type ModelBreakdownItem = {
  model: string
  tokens: number
  dollars: number
  percent: number
}

export type CostSummaryState = {
  todayUsd: number
  monthUsd: number
  todayTokens: number
  monthTokens: number
  todayBillableTokens: number
  monthBillableTokens: number
  trend: number[]
  breakdown: ModelBreakdownItem[]
}

export type DailyTokenBucket = {
  date: string
  totalTokens: number
  claudeTokens: number
  codexTokens: number
}

export type TranscriptEventCounts = {
  assistant: number
  user: number
  system: number
  attachment: number
  aiTitle: number
  mode: number
  permissionMode: number
  queueOperation: number
  fileHistorySnapshot: number
  lastPrompt: number
  other: number
}

export type SessionTerminalMetadata = {
  cwd: string | null
  kind: 'windowsTerminal' | 'terminalProgram' | 'unknown'
  wtSession?: string | null
  wtProfileId?: string | null
  wtProfileName?: string | null
  termProgram?: string | null
  shell?: string | null
  bridgeProcessId?: number | null
  bridgeParentProcessId?: number | null
  windowTitleHint?: string | null
  capturedAt: string
}

export type PendingQueueChoice = {
  id: string
  label: string
  kind?: 'allow' | 'deny' | 'answer' | 'dismiss'
}

export type PendingQueueItem = {
  id: string
  kind: 'approval' | 'question'
  status: 'pending' | 'resolved' | 'expired'
  sessionId?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  source: 'hook' | 'statusLine'
  hookEventName?: string | null
  permissionMode?: string | null
  toolName?: string | null
  projectSlug?: string | null
  cwdSlug?: string | null
  title: string
  summary?: string | null
  choices?: PendingQueueChoice[] | null
  privacyNote: string
}

export type PendingQueueState = {
  schemaVersion: number
  updatedAt: string
  items: PendingQueueItem[]
}

export type CurrentSessionState = {
  sessionKey?: string | null
  sessionId?: string | null
  sessionName?: string | null
  transcriptPath?: string | null
  projectDir?: string | null
  updatedAt?: string | null
  mode: SessionMode
  activity: SessionActivityState
  sourceLabel: string
  projectSlug: string
  lastEventLabel: string
  scannedAtLabel: string
  transcriptCount: number
  totalEventCount: number
  assistantEventCount: number
  userEventCount: number
  toolCallRecordCount: number
  toolResultFileCount: number
  privacyNote: string
  counts: TranscriptEventCounts
  bridgeStatusText?: string
  bridgeSource?: string
  bridgeHookEventName?: string | null
  activeToolName?: string | null
  permissionMode?: string | null
  modelLabel?: string | null
  contextUsedPercent?: number | null
  contextUsedTokens?: number | null
  contextWindowSize?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  cacheCreationInputTokens?: number | null
  cacheReadInputTokens?: number | null
  totalCostUsd?: number | null
  addedDirSlugs?: string[] | null
  addedDirsOverflowCount?: number | null
  gitBranch?: string | null
  gitDirty?: boolean | null
  gitAhead?: number | null
  gitBehind?: number | null
  sessionStartedAt?: string | null
  lastAssistantResponseAt?: string | null
  outputSpeed?: number | null
  toolsCount?: number | null
  toolsRunningCount?: number | null
  agentsCount?: number | null
  agentsRunningCount?: number | null
  todosActiveCount?: number | null
  todosCompletedCount?: number | null
  todosTotalCount?: number | null
  memoryUsedPercent?: number | null
  memoryUsedBytes?: number | null
  memoryTotalBytes?: number | null
  claudeMdCount?: number | null
  rulesCount?: number | null
  mcpCount?: number | null
  hooksCount?: number | null
  pendingQueue?: PendingQueueState | null
  terminal?: SessionTerminalMetadata | null
}

export type ClaudeCodeSummary = {
  mode: SessionMode
  projectSlug: string
  projectSource: string
  transcriptCount: number
  totalEvents: number
  toolCallRecordCount: number
  toolResultFileCount: number
  lastActivityAt: string | null
  scannedAt: string
  counts: TranscriptEventCounts
  privacyNote: string
}

export type ClaudeStatusBridgeState = {
  schemaVersion: number
  updatedAt: string
  activityStartedAt?: string
  event: string
  activity: SessionActivityState
  statusText: string
  sessionKey?: string | null
  sessionId: string | null
  sessionName: string | null
  cwd: string | null
  projectDir: string | null
  projectSlug: string | null
  transcriptPath: string | null
  modelId: string | null
  modelName: string | null
  version: string | null
  outputStyle: string | null
  contextUsedPercent: number | null
  contextRemainingPercent: number | null
  contextWindowSize: number | null
  contextUsedTokens: number | null
  permissionMode?: string | null
  inputTokens: number | null
  outputTokens: number | null
  cacheCreationInputTokens: number | null
  cacheReadInputTokens: number | null
  totalCostUsd: number | null
  totalDurationMs: number | null
  totalApiDurationMs: number | null
  totalLinesAdded: number | null
  totalLinesRemoved: number | null
  outputSpeed?: number | null
  addedDirSlugs?: string[] | null
  addedDirsOverflowCount?: number | null
  gitBranch?: string | null
  gitDirty?: boolean | null
  gitAhead?: number | null
  gitBehind?: number | null
  sessionStartedAt?: string | null
  lastAssistantResponseAt?: string | null
  agentsCount?: number | null
  agentsRunningCount?: number | null
  todosActiveCount?: number | null
  todosCompletedCount?: number | null
  todosTotalCount?: number | null
  memoryUsedPercent?: number | null
  memoryUsedBytes?: number | null
  memoryTotalBytes?: number | null
  claudeMdCount?: number | null
  rulesCount?: number | null
  mcpCount?: number | null
  hooksCount?: number | null
  pendingQueue?: PendingQueueState | null
  terminal?: SessionTerminalMetadata | null
  fiveHourUsedPercent: number | null
  fiveHourResetAt: string | null
  sevenDayUsedPercent: number | null
  sevenDayResetAt: string | null
  effortLevel: string | null
  thinkingEnabled: boolean | null
  agentName: string | null
  toolsCount?: number | null
  toolsRunningCount?: number | null
  hookEventName: string | null
  toolName: string | null
  source: string
  privacyNote: string
}

export type ProviderLiveState = {
  fiveHour: WindowUsageState
  weekly: WindowUsageState
  stale: boolean
  lastUpdatedLabel: string
  source: ProviderSource
  authStatus: ProviderAuthStatus
}

export type LiveUsageCostSnapshot = {
  claudeProvider: ProviderLiveState
  codexProvider: ProviderLiveState
  claudeCost: CostSummaryState
  codexCost: CostSummaryState
  dailyBuckets: DailyTokenBucket[]
  lastUsageSyncLabel: string
  lastCostSyncLabel: string
  privacyNote: string
}

export type SettingsState = {
  launchAtLogin: boolean
  refreshIntervalMinutes: 5 | 15 | 30
  language: AppLanguage
  alwaysShowUsage: boolean
  lowPowerMode: boolean
  fullscreenAvoidance: boolean
  alertsEnabled: boolean
  warningThreshold: number
  criticalThreshold: number
  targetDisplay: TargetDisplay
  topOffsetPx: number
  overlayPosition: OverlayPosition | null
  islandWidthMode: 'compact' | 'notch' | 'custom'
  chartStyle: ChartStyle
  costStyle: CostStyle
  tokenCountMode: TokenCountMode
  visibleProviders: Record<ProviderId, boolean>
  terminalHud: TerminalHudConfig
  desktopHud: DesktopHudConfig
}

export type AlertState = {
  severity: 'none' | 'warning' | 'critical'
  message?: string
}

export type IslandAppState = {
  providers: Record<ProviderId, ProviderState>
  cost: Record<ProviderId, CostSummaryState>
  dailyBuckets: DailyTokenBucket[]
  currentSession: CurrentSessionState
  sessions: CurrentSessionState[]
  settings: SettingsState
  alerts: AlertState
  lastUsageSyncLabel: string
  lastCostSyncLabel: string
}

export const providerOrder: ProviderId[] = ['claude', 'codex']
export const displayedProviderOrder: ProviderId[] = ['claude']
