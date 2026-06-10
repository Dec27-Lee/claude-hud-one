export type HudSurface = 'terminal' | 'desktop'
export type HudSurfaceScope = HudSurface | 'both'
export type HudLanguage = 'auto' | 'en' | 'zh-CN'
export type HudProvider = 'claude' | 'codex'
export type HudActivityState = 'idle' | 'active' | 'running' | 'waiting' | 'error'
export type HudItemKind = 'part' | 'line' | 'panel' | 'metric' | 'action'
export type HudSchemaControl = 'switch' | 'select' | 'number' | 'text' | 'color' | 'slider' | 'row-builder' | 'json'
export type HudParityStatus = 'ready' | 'partial' | 'planned' | 'blocked'

export type HudFieldOption = {
  label: string
  value: string | number | boolean
}

export type HudFieldSchema = {
  key: string
  label: string
  description?: string
  configPath: string
  group: string
  surface: HudSurfaceScope
  ui: HudSchemaControl
  options?: HudFieldOption[]
  defaultValue?: unknown
  advanced?: boolean
  requiresConfirm?: boolean
}

export type HudDisplayItemId =
  | 'model'
  | 'contextBar'
  | 'contextValue'
  | 'project'
  | 'git'
  | 'addedDirs'
  | 'sessionTokens'
  | 'usage'
  | 'promptCache'
  | 'memory'
  | 'environment'
  | 'tools'
  | 'agents'
  | 'todos'
  | 'activity'
  | 'sessionTime'
  | 'customLine'
  | 'cost'
  | 'duration'
  | 'speed'
  | 'outputStyle'
  | 'claudeCodeVersion'
  | 'effortLevel'

export type DisplayItemDefinition = {
  id: HudDisplayItemId
  label: string
  category: 'core' | 'project' | 'tokens' | 'resource' | 'activity' | 'time' | 'custom'
  kind: HudItemKind
  fieldKeys: string[]
  terminal: {
    supported: boolean
    configPath?: string
    upstreamItem?: string
    notes?: string
  }
  desktop: {
    supported: boolean
    configPath?: string
    componentHint?: string
    notes?: string
  }
}

export type DisplayItemRegistry = Record<HudDisplayItemId, DisplayItemDefinition>

export type HudParityMatrixRow = {
  item: HudDisplayItemId
  terminalStatus: HudParityStatus
  desktopStatus: HudParityStatus
  source: 'hud-plus' | 'hud-one' | 'shared'
  notes: string
}

export type NormalizedHudState = {
  schemaVersion: 1
  updatedAt: string | null
  provider: HudProvider
  language: HudLanguage
  session: {
    sessionKey?: string | null
    sessionId?: string | null
    sessionName?: string | null
    projectDir?: string | null
    projectSlug: string
    activity: HudActivityState
    sourceLabel: string
    statusText: string
    lastEventLabel: string
    scannedAtLabel: string
    startedAt?: string | null
    lastAssistantResponseAt?: string | null
    outputSpeed?: number | null
  }
  model: {
    id?: string | null
    label?: string | null
    outputStyle?: string | null
    claudeCodeVersion?: string | null
    effortLevel?: string | null
    thinkingEnabled?: boolean | null
  }
  context: {
    usedPercent?: number | null
    remainingPercent?: number | null
    windowSize?: number | null
    usedTokens?: number | null
  }
  workspace: {
    addedDirSlugs: string[]
    addedDirsOverflowCount: number
    gitBranch?: string | null
    gitDirty?: boolean | null
    gitAhead?: number | null
    gitBehind?: number | null
  }
  tokens: {
    input?: number | null
    output?: number | null
    cacheCreationInput?: number | null
    cacheReadInput?: number | null
    sessionInput?: number | null
    sessionOutput?: number | null
  }
  usage: {
    fiveHourUsedPercent?: number | null
    fiveHourResetAt?: string | null
    sevenDayUsedPercent?: number | null
    sevenDayResetAt?: string | null
  }
  cost: {
    totalUsd?: number | null
    totalDurationMs?: number | null
    totalApiDurationMs?: number | null
    totalLinesAdded?: number | null
    totalLinesRemoved?: number | null
  }
  activity: {
    activeToolName?: string | null
    toolsCount: number
    agentsCount: number
    agentsRunningCount: number
    todosCount: number
    todosActiveCount: number
    todosCompletedCount: number
  }
  system: {
    memoryUsedPercent?: number | null
    memoryUsedBytes?: number | null
    memoryTotalBytes?: number | null
    claudeMdCount: number
    rulesCount: number
    mcpCount: number
    hooksCount: number
  }
  diagnostics: {
    transcriptPath?: string | null
    transcriptCount: number
    totalEventCount: number
    assistantEventCount: number
    userEventCount: number
    toolCallRecordCount: number
    toolResultFileCount: number
    privacyNote: string
  }
}
