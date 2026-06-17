import type { HudDisplayItemId, HudLanguage } from './types'

export type TerminalHudRow = HudDisplayItemId[]
export type TerminalHudPreset = 'hud-plus-default' | 'minimal' | 'custom'
export type DesktopHudPreset = 'one-default' | 'terminal-parity' | 'custom'
export type MobileHudPreset = 'mobile-default' | 'minimal' | 'custom'
export type DesktopHudTerminalJumpBehavior = 'focus' | 'openCwd' | 'disabled'

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
    contextWindowSizeOverride: string
    contextWindowSizeOverrideManaged: boolean
    customLine: string
    timeFormat: TerminalHudTimeFormat
  }
}

export type DesktopHudZoneKey = 'compact' | 'peek' | 'panel' | 'ticker' | 'usagePage' | 'costPage' | 'overviewPage'

export type DesktopHudZones = Record<DesktopHudZoneKey, HudDisplayItemId[]>

export type DesktopHudItemOptions = Partial<Record<HudDisplayItemId, Record<string, unknown>>>

export type MobileHudSectionKey = 'capsule' | 'live' | 'sessions' | 'attention' | 'diagnostics'

export type MobileHudSections = Record<MobileHudSectionKey, HudDisplayItemId[]>

export type MobileHudConfig = {
  version: 1
  enabled: boolean
  preset: MobileHudPreset
  density: 'compact' | 'comfortable'
  connection: {
    mode: 'wifiLan'
    port: number
    autoStart: boolean
    requirePcConfirmation: boolean
  }
  security: {
    transport: 'wssSpkiPinning' | 'noiseAead'
    deviceSigning: 'p256Ecdsa' | 'applicationKey'
    pairingTokenTtlSeconds: number
    reconnectPolicy: 'foregroundOnly' | 'backgroundWhenAllowed'
  }
  notifications: {
    enabled: boolean
    attention: boolean
    completion: boolean
    errors: boolean
    connection: boolean
    privacy: 'low'
  }
  visibleItems: Partial<Record<HudDisplayItemId, boolean>>
  sections: MobileHudSections
  readOnly: true
}

export type DesktopHudConfig = {
  version: 4
  enabled: boolean
  preset: DesktopHudPreset
  density: 'compact' | 'comfortable'
  defaultPage: 'usage' | 'cost' | 'overview'
  visibleItems: Partial<Record<HudDisplayItemId, boolean>>
  zones: DesktopHudZones
  itemOptions: DesktopHudItemOptions
  hoverDelayMs: number
  collapseDelayMs: number
  maxVisibleSessions: number
  mascotSpeed: 'slow' | 'normal' | 'fast'
  animationIntensity: 'reduced' | 'normal' | 'expressive'
  autoExpandOnWaiting: boolean
  autoExpandOnCompletion: boolean
  smartSuppress: boolean
  terminalJumpBehavior: DesktopHudTerminalJumpBehavior
  /** @deprecated V1 compatibility: use zones.panel. */
  panelItems: HudDisplayItemId[]
  /** @deprecated V1 compatibility: use zones.ticker. */
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
  preset: 'custom',
  language: 'en',
  rows: [
    ['model', 'contextBar', 'contextValue'],
    ['project', 'addedDirs', 'git'],
    ['sessionTokens', 'sessionTime'],
    ['activity'],
  ],
  rowOverflow: 'truncate',
  activityLine: {
    mode: 'auto',
    maxWidthRatio: 1,
    toolNameFormat: 'short',
    items: {
      todos: true,
      agents: true,
      tools: true,
      sessionTime: false,
    },
    warnings: {
      usage: false,
      memory: false,
      environment: false,
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
    showAheadBehind: true,
    showFileStats: true,
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
    label: '#38BDF8',
    labelTitle: '#38BDF8',
    labelValue: '#b8eaff',
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
    showEffortLevel: true,
    showMemoryUsage: false,
    showEnvironment: false,
    showPromptCache: false,
    promptCacheTtlSeconds: 300,
    showSessionTokens: true,
    showOutputStyle: false,
    showSessionStartDate: true,
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
    contextWindowSizeOverride: '',
    contextWindowSizeOverrideManaged: true,
    customLine: '',
    timeFormat: 'relative',
  },
}

export const DEFAULT_DESKTOP_HUD_ZONES: DesktopHudZones = {
  compact: ['activity', 'project', 'tools'],
  peek: ['activity', 'project', 'tools', 'git'],
  panel: ['contextValue', 'tools', 'model', 'git', 'agents', 'todos'],
  ticker: ['activity', 'project', 'tools'],
  usagePage: ['usage', 'contextValue', 'sessionTokens'],
  costPage: ['cost', 'sessionTokens', 'model'],
  overviewPage: ['activity', 'project', 'git', 'agents', 'todos'],
}

export const DEFAULT_MOBILE_HUD_SECTIONS: MobileHudSections = {
  capsule: ['activity', 'project', 'model'],
  live: ['contextValue', 'sessionTokens', 'usage', 'cost'],
  sessions: ['activity', 'project', 'model', 'tools'],
  attention: ['activity', 'tools'],
  diagnostics: ['usage', 'cost'],
}

export const DEFAULT_MOBILE_HUD_CONFIG: MobileHudConfig = {
  version: 1,
  enabled: false,
  preset: 'mobile-default',
  density: 'compact',
  connection: {
    mode: 'wifiLan',
    port: 27431,
    autoStart: false,
    requirePcConfirmation: true,
  },
  security: {
    transport: 'wssSpkiPinning',
    deviceSigning: 'p256Ecdsa',
    pairingTokenTtlSeconds: 60,
    reconnectPolicy: 'foregroundOnly',
  },
  notifications: {
    enabled: true,
    attention: true,
    completion: true,
    errors: true,
    connection: true,
    privacy: 'low',
  },
  visibleItems: {
    activity: true,
    project: true,
    model: true,
    tools: true,
    contextValue: true,
    sessionTokens: true,
    usage: true,
    cost: true,
    git: true,
    addedDirs: true,
    agents: true,
    todos: true,
    speed: true,
    effortLevel: true,
  },
  sections: {
    capsule: [...DEFAULT_MOBILE_HUD_SECTIONS.capsule],
    live: [...DEFAULT_MOBILE_HUD_SECTIONS.live],
    sessions: [...DEFAULT_MOBILE_HUD_SECTIONS.sessions],
    attention: [...DEFAULT_MOBILE_HUD_SECTIONS.attention],
    diagnostics: [...DEFAULT_MOBILE_HUD_SECTIONS.diagnostics],
  },
  readOnly: true,
}

export const DEFAULT_DESKTOP_HUD_CONFIG: DesktopHudConfig = {
  version: 4,
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
    effortLevel: true,
  },
  zones: {
    compact: [...DEFAULT_DESKTOP_HUD_ZONES.compact],
    peek: [...DEFAULT_DESKTOP_HUD_ZONES.peek],
    panel: [...DEFAULT_DESKTOP_HUD_ZONES.panel],
    ticker: [...DEFAULT_DESKTOP_HUD_ZONES.ticker],
    usagePage: [...DEFAULT_DESKTOP_HUD_ZONES.usagePage],
    costPage: [...DEFAULT_DESKTOP_HUD_ZONES.costPage],
    overviewPage: [...DEFAULT_DESKTOP_HUD_ZONES.overviewPage],
  },
  itemOptions: {},
  hoverDelayMs: 500,
  collapseDelayMs: 150,
  maxVisibleSessions: 6,
  mascotSpeed: 'normal',
  animationIntensity: 'normal',
  autoExpandOnWaiting: true,
  autoExpandOnCompletion: true,
  smartSuppress: true,
  terminalJumpBehavior: 'focus',
  panelItems: ['contextValue', 'tools', 'model', 'git', 'agents', 'todos'],
  tickerItems: ['activity', 'project', 'tools'],
}

export const mergeTerminalHudConfig = (base: TerminalHudConfig, patch?: Partial<TerminalHudConfig>): TerminalHudConfig => {
  const defaultPreset = patch?.preset === 'hud-plus-default'
  const displayPatch = defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.display : patch?.display
  return {
    ...base,
    ...patch,
    rows: defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.rows : (patch?.rows ?? base.rows),
    elementOrder: patch?.elementOrder ?? base.elementOrder,
    activityLine: {
      ...base.activityLine,
      ...(defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.activityLine : patch?.activityLine),
      items: {
        ...base.activityLine.items,
        ...(defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.activityLine.items : patch?.activityLine?.items),
      },
      warnings: {
        ...base.activityLine.warnings,
        ...(defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.activityLine.warnings : patch?.activityLine?.warnings),
      },
    },
    gitStatus: {
      ...base.gitStatus,
      ...(defaultPreset ? DEFAULT_TERMINAL_HUD_CONFIG.gitStatus : patch?.gitStatus),
    },
    colors: {
      ...base.colors,
      ...patch?.colors,
      contextBands: patch?.colors?.contextBands ?? base.colors.contextBands,
      usageBands: patch?.colors?.usageBands ?? base.colors.usageBands,
    },
    display: {
      ...base.display,
      ...displayPatch,
      mergeGroups: displayPatch?.mergeGroups ?? base.display.mergeGroups,
    },
  }
}

type MobileHudPatch = Partial<Omit<MobileHudConfig, 'version' | 'sections'>> & {
  version?: number
  sections?: Partial<MobileHudSections>
}

const clampMobileNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

const mobileSection = (raw: unknown, fallback: HudDisplayItemId[]): HudDisplayItemId[] => (
  Array.isArray(raw) ? raw.filter((item): item is HudDisplayItemId => typeof item === 'string') : [...fallback]
)

const isMobilePreset = (value: unknown): value is MobileHudPreset => value === 'mobile-default' || value === 'minimal' || value === 'custom'
const isMobileDensity = (value: unknown): value is MobileHudConfig['density'] => value === 'compact' || value === 'comfortable'
const isMobileTransport = (value: unknown): value is MobileHudConfig['security']['transport'] => value === 'wssSpkiPinning' || value === 'noiseAead'
const isMobileDeviceSigning = (value: unknown): value is MobileHudConfig['security']['deviceSigning'] => value === 'p256Ecdsa' || value === 'applicationKey'
const isMobileReconnectPolicy = (value: unknown): value is MobileHudConfig['security']['reconnectPolicy'] => value === 'foregroundOnly' || value === 'backgroundWhenAllowed'

export const normalizeMobileHudConfig = (raw?: MobileHudPatch | Partial<MobileHudConfig> | null): MobileHudConfig => {
  const base = DEFAULT_MOBILE_HUD_CONFIG
  const patch = (raw ?? {}) as MobileHudPatch
  const rawSections = patch.sections ?? {}

  return {
    ...base,
    ...patch,
    version: 1,
    enabled: patch.enabled ?? base.enabled,
    preset: isMobilePreset(patch.preset) ? patch.preset : base.preset,
    density: isMobileDensity(patch.density) ? patch.density : base.density,
    connection: {
      ...base.connection,
      ...patch.connection,
      mode: 'wifiLan',
      port: clampMobileNumber(patch.connection?.port, base.connection.port, 1024, 65535),
      autoStart: patch.connection?.autoStart ?? base.connection.autoStart,
      requirePcConfirmation: patch.connection?.requirePcConfirmation ?? base.connection.requirePcConfirmation,
    },
    security: {
      ...base.security,
      ...patch.security,
      transport: isMobileTransport(patch.security?.transport) ? patch.security.transport : base.security.transport,
      deviceSigning: isMobileDeviceSigning(patch.security?.deviceSigning) ? patch.security.deviceSigning : base.security.deviceSigning,
      pairingTokenTtlSeconds: clampMobileNumber(patch.security?.pairingTokenTtlSeconds, base.security.pairingTokenTtlSeconds, 15, 300),
      reconnectPolicy: isMobileReconnectPolicy(patch.security?.reconnectPolicy) ? patch.security.reconnectPolicy : base.security.reconnectPolicy,
    },
    notifications: {
      ...base.notifications,
      ...patch.notifications,
      privacy: 'low',
    },
    visibleItems: {
      ...base.visibleItems,
      ...patch.visibleItems,
    },
    sections: {
      capsule: mobileSection(rawSections.capsule, base.sections.capsule),
      live: mobileSection(rawSections.live, base.sections.live),
      sessions: mobileSection(rawSections.sessions, base.sections.sessions),
      attention: mobileSection(rawSections.attention, base.sections.attention),
      diagnostics: mobileSection(rawSections.diagnostics, base.sections.diagnostics),
    },
    readOnly: true,
  }
}

export const mergeMobileHudConfig = (base: MobileHudConfig, patch?: MobileHudPatch): MobileHudConfig => {
  const normalizedBase = normalizeMobileHudConfig(base)
  return patch
    ? normalizeMobileHudConfig({
      ...normalizedBase,
      ...patch,
      connection: { ...normalizedBase.connection, ...patch.connection },
      security: { ...normalizedBase.security, ...patch.security },
      notifications: { ...normalizedBase.notifications, ...patch.notifications },
      visibleItems: { ...normalizedBase.visibleItems, ...patch.visibleItems },
      sections: { ...normalizedBase.sections, ...patch.sections },
    })
    : normalizedBase
}

type DesktopHudPatch = Partial<Omit<DesktopHudConfig, 'version' | 'zones' | 'itemOptions'>> & {
  version?: number
  zones?: Partial<DesktopHudZones>
  itemOptions?: DesktopHudItemOptions
  panelItems?: HudDisplayItemId[]
  tickerItems?: HudDisplayItemId[]
}

const clampDesktopNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

const desktopZone = (raw: unknown, fallback: HudDisplayItemId[]): HudDisplayItemId[] => (
  Array.isArray(raw) ? raw.filter((item): item is HudDisplayItemId => typeof item === 'string') : [...fallback]
)

const isDesktopTerminalJumpBehavior = (value: unknown): value is DesktopHudTerminalJumpBehavior => (
  value === 'focus' || value === 'openCwd' || value === 'disabled'
)

export const normalizeDesktopHudConfig = (raw?: DesktopHudPatch | Partial<DesktopHudConfig> | null): DesktopHudConfig => {
  const base = DEFAULT_DESKTOP_HUD_CONFIG
  const patch = (raw ?? {}) as DesktopHudPatch
  const rawZones = patch.zones ?? {}
  const panelItems = desktopZone(patch.panelItems, base.panelItems)
  const tickerItems = desktopZone(patch.tickerItems, base.tickerItems)
  const zones: DesktopHudZones = {
    compact: desktopZone(rawZones.compact, base.zones.compact),
    peek: desktopZone(rawZones.peek, base.zones.peek),
    panel: desktopZone(rawZones.panel, panelItems.length ? panelItems : base.zones.panel),
    ticker: desktopZone(rawZones.ticker, tickerItems.length ? tickerItems : base.zones.ticker),
    usagePage: desktopZone(rawZones.usagePage, base.zones.usagePage),
    costPage: desktopZone(rawZones.costPage, base.zones.costPage),
    overviewPage: desktopZone(rawZones.overviewPage, base.zones.overviewPage),
  }
  const patchVersion = typeof patch.version === 'number' ? patch.version : 1
  const terminalJumpBehavior = isDesktopTerminalJumpBehavior(patch.terminalJumpBehavior)
    ? (patchVersion === 3 && patch.terminalJumpBehavior === 'openCwd' ? base.terminalJumpBehavior : patch.terminalJumpBehavior)
    : base.terminalJumpBehavior

  return {
    ...base,
    ...patch,
    version: 4,
    visibleItems: {
      ...base.visibleItems,
      ...patch.visibleItems,
    },
    zones,
    itemOptions: {
      ...base.itemOptions,
      ...patch.itemOptions,
    },
    hoverDelayMs: clampDesktopNumber(patch.hoverDelayMs, base.hoverDelayMs, 0, 2000),
    collapseDelayMs: clampDesktopNumber(patch.collapseDelayMs, base.collapseDelayMs, 0, 2000),
    maxVisibleSessions: clampDesktopNumber(patch.maxVisibleSessions, base.maxVisibleSessions, 1, 12),
    mascotSpeed: patch.mascotSpeed ?? base.mascotSpeed,
    animationIntensity: patch.animationIntensity ?? base.animationIntensity,
    autoExpandOnWaiting: patch.autoExpandOnWaiting ?? base.autoExpandOnWaiting,
    autoExpandOnCompletion: patch.autoExpandOnCompletion ?? base.autoExpandOnCompletion,
    smartSuppress: patch.smartSuppress ?? base.smartSuppress,
    terminalJumpBehavior,
    panelItems: [...zones.panel],
    tickerItems: [...zones.ticker],
  }
}

export const mergeDesktopHudConfig = (base: DesktopHudConfig, patch?: DesktopHudPatch): DesktopHudConfig => {
  const normalizedBase = normalizeDesktopHudConfig(base)
  const normalizedPatch = patch ? normalizeDesktopHudConfig({ ...normalizedBase, ...patch, visibleItems: { ...normalizedBase.visibleItems, ...patch.visibleItems }, zones: { ...normalizedBase.zones, ...patch.zones }, itemOptions: { ...normalizedBase.itemOptions, ...patch.itemOptions } }) : normalizedBase
  return normalizedPatch
}

