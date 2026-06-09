export type ProviderId = 'claude' | 'codex'
export type IslandViewState = 'compact' | 'peek' | 'expanded'
export type IslandPage = 'usage' | 'cost' | 'overview'
export type ChartStyle = 'ring' | 'bar' | 'stepped' | 'numeric' | 'sparkline'
export type CostStyle = 'usd' | 'value' | 'tokens' | 'trend'
export type TokenCountMode = 'all' | 'billable'
export type AppLanguage = 'auto' | 'en' | 'zh-CN'
export type TargetDisplay = 'auto' | 'primary' | { id: string; label: string }
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

export type CurrentSessionState = {
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
  modelLabel?: string | null
  contextUsedPercent?: number | null
  totalCostUsd?: number | null
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
  event: string
  activity: SessionActivityState
  statusText: string
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
  inputTokens: number | null
  outputTokens: number | null
  cacheCreationInputTokens: number | null
  cacheReadInputTokens: number | null
  totalCostUsd: number | null
  totalDurationMs: number | null
  totalApiDurationMs: number | null
  totalLinesAdded: number | null
  totalLinesRemoved: number | null
  fiveHourUsedPercent: number | null
  fiveHourResetAt: string | null
  sevenDayUsedPercent: number | null
  sevenDayResetAt: string | null
  effortLevel: string | null
  thinkingEnabled: boolean | null
  agentName: string | null
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
  islandWidthMode: 'compact' | 'notch' | 'custom'
  chartStyle: ChartStyle
  costStyle: CostStyle
  tokenCountMode: TokenCountMode
  visibleProviders: Record<ProviderId, boolean>
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
  settings: SettingsState
  alerts: AlertState
  lastUsageSyncLabel: string
  lastCostSyncLabel: string
}

export const providerOrder: ProviderId[] = ['claude', 'codex']
export const displayedProviderOrder: ProviderId[] = ['claude']
