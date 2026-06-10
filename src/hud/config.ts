import type { HudDisplayItemId, HudLanguage } from './types'

export type TerminalHudRow = HudDisplayItemId[]
export type TerminalHudPreset = 'hud-plus-default' | 'minimal' | 'custom'
export type DesktopHudPreset = 'one-default' | 'terminal-parity' | 'custom'

export type TerminalHudRowOverflow = 'truncate' | 'wrap'
export type TerminalHudAddedDirsLayout = 'inline' | 'line'
export type TerminalHudContextValue = 'percent' | 'tokens' | 'remaining' | 'both'
export type TerminalHudUsageValue = 'percent' | 'remaining'
export type TerminalHudAutocompactBuffer = 'enabled' | 'disabled'
export type TerminalHudModelFormat = 'full' | 'compact' | 'short'
export type TerminalHudTimeFormat = 'relative' | 'absolute' | 'both'
export type TerminalHudActivityMode = 'auto' | 'details' | 'summary'
export type TerminalHudToolNameFormat = 'full' | 'short'
export type TerminalHudGitBranchOverflow = 'truncate' | 'wrap'
export type TerminalHudColorValue = string | number
export type TerminalHudElement =
  | 'project'
  | 'addedDirs'
  | 'context'
  | 'usage'
  | 'promptCache'
  | 'memory'
  | 'environment'
  | 'tools'
  | 'agents'
  | 'todos'
  | 'sessionTime'
export type TerminalHudActivityItem = 'todos' | 'agents' | 'tools' | 'sessionTime'
export type TerminalHudActivityWarningItem = 'usage' | 'memory' | 'environment' | 'promptCache'

export type TerminalHudColorBand = {
  min: number
  color: TerminalHudColorValue
}

export type TerminalHudColors = {
  context: TerminalHudColorValue
  usage: TerminalHudColorValue
  warning: TerminalHudColorValue
  usageWarning: TerminalHudColorValue
  critical: TerminalHudColorValue
  model: TerminalHudColorValue
  project: TerminalHudColorValue
  git: TerminalHudColorValue
  gitBranch: TerminalHudColorValue
  label: TerminalHudColorValue
  labelTitle: TerminalHudColorValue
  labelValue: TerminalHudColorValue
  custom: TerminalHudColorValue
  barFilled: string
  barEmpty: string
  contextBands: TerminalHudColorBand[]
  usageBands: TerminalHudColorBand[]
}

export type TerminalHudActivityLineConfig = {
  mode: TerminalHudActivityMode
  maxWidthRatio: number
  toolNameFormat: TerminalHudToolNameFormat
  items: Record<TerminalHudActivityItem, boolean>
  warnings: Record<TerminalHudActivityWarningItem, boolean>
}

export type TerminalHudGitStatusConfig = {
  enabled: boolean
  showDirty: boolean
  showAheadBehind: boolean
  showFileStats: boolean
  branchOverflow: TerminalHudGitBranchOverflow
  pushWarningThreshold: number
  pushCriticalThreshold: number
}

export type TerminalHudConfig = {
  enabled: boolean
  preset: TerminalHudPreset
  language: HudLanguage
  rows: TerminalHudRow[]
  rowOverflow: TerminalHudRowOverflow
  activityLine: TerminalHudActivityLineConfig
  showSeparators: boolean
  pathLevels: 1 | 2 | 3
  maxWidth: number | null
  elementOrder: TerminalHudElement[]
  gitStatus: TerminalHudGitStatusConfig
  colors: TerminalHudColors
  display: {
    showModel: boolean
    showProject: boolean
    showAddedDirs: boolean
    addedDirsLayout: TerminalHudAddedDirsLayout
    showContextBar: boolean
    contextValue: TerminalHudContextValue
    showConfigCounts: boolean
    showSessionTokens: boolean
    showTokenBreakdown: boolean
    showUsage: boolean
    usageValue: TerminalHudUsageValue
    usageBarEnabled: boolean
    showResetLabel: boolean
    usageCompact: boolean
    showTools: boolean
    showAgents: boolean
    showTodos: boolean
    showMemoryUsage: boolean
    showEnvironment: boolean
    showPromptCache: boolean
    promptCacheTtlSeconds: number
    showCost: boolean
    showDuration: boolean
    showSpeed: boolean
    showOutputStyle: boolean
    showSessionName: boolean
    showClaudeCodeVersion: boolean
    showEffortLevel: boolean
    showSessionStartDate: boolean
    showLastResponseAt: boolean
    mergeGroups: TerminalHudElement[][]
    autocompactBuffer: TerminalHudAutocompactBuffer
    contextWarningThreshold: number
    contextCriticalThreshold: number
    usageThreshold: number
    sevenDayThreshold: number
    environmentThreshold: number
    externalUsagePath: string
    externalUsageFreshnessMs: number
    modelFormat: TerminalHudModelFormat
    modelOverride: string
    customLine: string
    timeFormat: TerminalHudTimeFormat
  }
}

export type DesktopHudConfig = {
  enabled: boolean
  preset: DesktopHudPreset
  density: 'compact' | 'comfortable'
  defaultPage: 'usage' | 'cost' | 'overview'
  visibleItems: Partial<Record<HudDisplayItemId, boolean>>
  panelItems: HudDisplayItemId[]
  tickerItems: HudDisplayItemId[]
}

export const DEFAULT_TERMINAL_HUD_ELEMENT_ORDER: TerminalHudElement[] = [
  'project',
  'addedDirs',
  'context',
  'usage',
  'promptCache',
  'memory',
  'environment',
  'tools',
  'agents',
  'todos',
  'sessionTime',
]

export const DEFAULT_TERMINAL_HUD_MERGE_GROUPS: TerminalHudElement[][] = [
  ['context', 'usage'],
]

export const DEFAULT_TERMINAL_HUD_CONFIG: TerminalHudConfig = {
  enabled: true,
  preset: 'hud-plus-default',
  language: 'en',
  rows: [
    ['model', 'contextBar', 'contextValue'],
    ['project', 'addedDirs', 'git'],
    ['sessionTokens'],
    ['activity'],
  ],
  rowOverflow: 'truncate',
  activityLine: {
    mode: 'auto',
    maxWidthRatio: 0.9,
    toolNameFormat: 'short',
    items: {
      todos: true,
      agents: true,
      tools: true,
      sessionTime: false,
    },
    warnings: {
      usage: true,
      memory: true,
      environment: true,
      promptCache: false,
    },
  },
  showSeparators: false,
  pathLevels: 1,
  maxWidth: null,
  elementOrder: [...DEFAULT_TERMINAL_HUD_ELEMENT_ORDER],
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: false,
    showFileStats: false,
    branchOverflow: 'truncate',
    pushWarningThreshold: 0,
    pushCriticalThreshold: 0,
  },
  colors: {
    context: '#22D3EE',
    usage: 'brightBlue',
    warning: '#F59E0B',
    usageWarning: 'brightMagenta',
    critical: '#F43F5E',
    model: '#38BDF8',
    project: '#FBBF24',
    git: '#C084FC',
    gitBranch: '#22D3EE',
    label: 'dim',
    labelTitle: 'dim',
    labelValue: 'dim',
    custom: 208,
    barFilled: '█',
    barEmpty: '░',
    contextBands: [],
    usageBands: [],
  },
  display: {
    showModel: true,
    showProject: true,
    showAddedDirs: true,
    addedDirsLayout: 'inline',
    showContextBar: true,
    contextValue: 'both',
    showConfigCounts: false,
    showCost: false,
    showDuration: false,
    showSpeed: false,
    showTokenBreakdown: true,
    showUsage: false,
    usageValue: 'percent',
    usageBarEnabled: true,
    showResetLabel: true,
    usageCompact: false,
    showTools: true,
    showAgents: true,
    showTodos: true,
    showSessionName: false,
    showClaudeCodeVersion: false,
    showEffortLevel: false,
    showMemoryUsage: false,
    showEnvironment: false,
    showPromptCache: false,
    promptCacheTtlSeconds: 300,
    showSessionTokens: true,
    showOutputStyle: false,
    showSessionStartDate: false,
    showLastResponseAt: false,
    mergeGroups: DEFAULT_TERMINAL_HUD_MERGE_GROUPS.map((group) => [...group]),
    autocompactBuffer: 'enabled',
    contextWarningThreshold: 70,
    contextCriticalThreshold: 85,
    usageThreshold: 0,
    sevenDayThreshold: 80,
    environmentThreshold: 0,
    externalUsagePath: '',
    externalUsageFreshnessMs: 300000,
    modelFormat: 'full',
    modelOverride: '',
    customLine: '',
    timeFormat: 'relative',
  },
}

export const DEFAULT_DESKTOP_HUD_CONFIG: DesktopHudConfig = {
  enabled: true,
  preset: 'one-default',
  density: 'compact',
  defaultPage: 'usage',
  visibleItems: {
    model: true,
    contextValue: true,
    project: true,
    sessionTokens: true,
    usage: true,
    cost: true,
    tools: true,
    activity: true,
    git: true,
    addedDirs: true,
    agents: true,
    todos: true,
    speed: true,
  },
  panelItems: ['contextValue', 'tools', 'model', 'git', 'agents', 'todos'],
  tickerItems: ['activity', 'project', 'tools'],
}

export const mergeTerminalHudConfig = (base: TerminalHudConfig, patch?: Partial<TerminalHudConfig>): TerminalHudConfig => ({
  ...base,
  ...patch,
  rows: patch?.rows ?? base.rows,
  elementOrder: patch?.elementOrder ?? base.elementOrder,
  activityLine: {
    ...base.activityLine,
    ...patch?.activityLine,
    items: {
      ...base.activityLine.items,
      ...patch?.activityLine?.items,
    },
    warnings: {
      ...base.activityLine.warnings,
      ...patch?.activityLine?.warnings,
    },
  },
  gitStatus: {
    ...base.gitStatus,
    ...patch?.gitStatus,
  },
  colors: {
    ...base.colors,
    ...patch?.colors,
    contextBands: patch?.colors?.contextBands ?? base.colors.contextBands,
    usageBands: patch?.colors?.usageBands ?? base.colors.usageBands,
  },
  display: {
    ...base.display,
    ...patch?.display,
    mergeGroups: patch?.display?.mergeGroups ?? base.display.mergeGroups,
  },
})

export const mergeDesktopHudConfig = (base: DesktopHudConfig, patch?: Partial<DesktopHudConfig>): DesktopHudConfig => ({
  ...base,
  ...patch,
  visibleItems: {
    ...base.visibleItems,
    ...patch?.visibleItems,
  },
  panelItems: patch?.panelItems ?? base.panelItems,
  tickerItems: patch?.tickerItems ?? base.tickerItems,
})
