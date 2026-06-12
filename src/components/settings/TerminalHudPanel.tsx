import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { setClaudeHudContextWindowSize } from '../../app/overlayBridge'
import type { SettingsState } from '../../app/types'
import { DEFAULT_TERMINAL_HUD_CONFIG, mergeTerminalHudConfig, type TerminalHudColorValue, type TerminalHudConfig, type TerminalHudPreset } from '../../hud/config'
import type { HudDisplayItemId, NormalizedHudState } from '../../hud/types'
import { DISPLAY_ITEM_REGISTRY, terminalDisplayItemIds } from '../../hud/displayItemRegistry'
import { renderTerminalHudItem, renderTerminalHudPreviewLines } from '../../hud/terminalRenderer'

type TerminalHudPanelProps = {
  config: TerminalHudConfig
  language: 'en' | 'zh-CN'
  previewState: NormalizedHudState
  claudeContextWindowSize?: string | null
  onPatchSettings: (settings: Partial<SettingsState>) => void
}

type BuilderWorkspace = 'components' | 'colors' | 'json'
type SelectionState = { rowIndex: number; itemIndex: number; item: HudDisplayItemId } | null
type DragPayload = { item: HudDisplayItemId; fromRow?: number; fromIndex?: number }
type PalettePointerDrag = { item: HudDisplayItemId; label: string; x: number; y: number; active: boolean } | null
type PalettePointerDragRef = { item: HudDisplayItemId; label: string; startX: number; startY: number; active: boolean }
type PalettePointerEvent = PointerEvent | MouseEvent
type PalettePointerListeners = {
  pointerMove: (event: PointerEvent) => void
  pointerEnd: (event: PointerEvent) => void
  pointerCancel: (event: PointerEvent) => void
  mouseMove: (event: MouseEvent) => void
  mouseEnd: (event: MouseEvent) => void
}

type TerminalHudDisplayBooleanKey = {
  [Key in keyof TerminalHudConfig['display']]: TerminalHudConfig['display'][Key] extends boolean ? Key : never
}[keyof TerminalHudConfig['display']]

type TerminalHudColorKey = Exclude<keyof TerminalHudConfig['colors'], 'barFilled' | 'barEmpty' | 'contextBands' | 'usageBands'>

const terminalPresets: TerminalHudPreset[] = ['hud-plus-default', 'minimal', 'custom']
const rowOverflowModes: TerminalHudConfig['rowOverflow'][] = ['truncate', 'wrap']
const contextValueModes: TerminalHudConfig['display']['contextValue'][] = ['both', 'percent', 'tokens', 'remaining']
const usageValueModes: TerminalHudConfig['display']['usageValue'][] = ['percent', 'remaining']
const addedDirsLayouts: TerminalHudConfig['display']['addedDirsLayout'][] = ['inline', 'line']
const modelFormatModes: TerminalHudConfig['display']['modelFormat'][] = ['full', 'compact', 'short']
const timeFormatModes: TerminalHudConfig['display']['timeFormat'][] = ['relative', 'absolute', 'both']
const activityModes: TerminalHudConfig['activityLine']['mode'][] = ['auto', 'details', 'summary']
const toolNameFormats: TerminalHudConfig['activityLine']['toolNameFormat'][] = ['short', 'full']
const branchOverflowModes: TerminalHudConfig['gitStatus']['branchOverflow'][] = ['truncate', 'wrap']
const barKeys: Array<'barFilled' | 'barEmpty'> = ['barFilled', 'barEmpty']

const colorGroups: Array<{ id: string; label: string; items: TerminalHudColorKey[] }> = [
  { id: 'semantic', label: 'Semantic labels', items: ['label', 'labelTitle', 'labelValue'] },
  { id: 'model', label: 'Model', items: ['model'] },
  { id: 'project', label: 'Project', items: ['project'] },
  { id: 'git', label: 'Git', items: ['git', 'gitBranch'] },
  { id: 'context', label: 'Context', items: ['context', 'warning', 'critical'] },
  { id: 'usage-memory', label: 'Usage / memory', items: ['usage', 'usageWarning'] },
  { id: 'custom', label: 'Custom', items: ['custom'] },
]

const itemColorGroups: Partial<Record<HudDisplayItemId, string[]>> = {
  model: ['model'],
  project: ['project'],
  customLine: ['custom'],
  git: ['git'],
  contextBar: ['context'],
  contextValue: ['context'],
  usage: ['usage-memory'],
  memory: ['usage-memory'],
  activity: ['semantic'],
}

const itemZhLabels: Record<HudDisplayItemId, string> = {
  model: '模型',
  contextBar: '上下文进度条',
  contextValue: '上下文数值',
  project: '项目',
  git: 'Git',
  addedDirs: '附加目录',
  sessionTokens: '会话 Token',
  usage: '用量',
  promptCache: 'Prompt 缓存',
  memory: '内存',
  environment: '环境',
  tools: '工具',
  agents: '子代理',
  todos: '任务',
  activity: '活动',
  sessionTime: '会话时间',
  customLine: '自定义行',
  cost: '成本',
  duration: '耗时',
  speed: '速度',
  outputStyle: '输出风格',
  claudeCodeVersion: 'Claude Code 版本',
  effortLevel: '思考强度',
}

const categoryZhLabels: Record<string, string> = {
  core: '核心',
  project: '项目',
  tokens: 'Token',
  resource: '资源',
  activity: '活动',
  time: '时间',
  custom: '自定义',
}

const kindZhLabels: Record<string, string> = {
  part: '片段',
  line: '行',
  metric: '指标',
}

const configZhLabels: Record<string, string> = {
  'gitStatus.enabled': '启用 Git 状态',
  showDirty: '显示未提交状态',
  showAheadBehind: '显示领先/落后',
  showFileStats: '显示文件统计',
  branchOverflow: '分支名溢出策略',
  pushWarningThreshold: '推送提醒阈值',
  pushCriticalThreshold: '推送严重阈值',
  contextValue: '上下文数值',
  autocompactBuffer: '自动压缩缓冲',
  contextWarningThreshold: '上下文警告阈值',
  contextCriticalThreshold: '上下文严重阈值',
  pathLevels: '路径层级',
  modelFormat: '模型格式',
  modelOverride: '模型覆盖文本',
  contextWindowSizeOverride: '上下文窗口大小',
  showEffortLevel: '显示思考强度',
  showTokenBreakdown: '显示 Token 明细',
  showSessionStartDate: '显示会话开始时间',
  showLastResponseAt: '显示最后回复时间',
  timeFormat: '时间格式',
  usageValue: '用量数值',
  usageBarEnabled: '显示用量进度条',
  usageCompact: '紧凑用量',
  showResetLabel: '显示重置时间',
  usageThreshold: '用量阈值',
  sevenDayThreshold: '7 天阈值',
  addedDirsLayout: '附加目录布局',
  promptCacheTtlSeconds: 'Prompt 缓存 TTL',
  environmentThreshold: '环境提醒阈值',
  customLine: '自定义文本',
  'activityLine.mode': '活动行模式',
  toolNameFormat: '工具名格式',
  maxWidthRatio: '最大宽度比例',
  'items.todos': '任务',
  'items.agents': '子代理',
  'items.tools': '工具',
  'items.sessionTime': '会话时间',
  'warnings.usage': '用量警告',
  'warnings.memory': '内存警告',
  'warnings.environment': '环境警告',
  'warnings.promptCache': 'Prompt 缓存警告',
  contextBands: '上下文区间颜色',
  usageBands: '用量/内存区间颜色',
  barCharacters: '进度条字符',
  min: '最小值',
  color: '颜色',
}

const enumZhLabels: Record<string, string> = {
  truncate: '截断',
  wrap: '换行',
  both: '百分比和 Token',
  percent: '百分比',
  tokens: 'Token',
  remaining: '剩余',
  enabled: '启用',
  disabled: '禁用',
  full: '完整',
  compact: '紧凑',
  short: '短名',
  relative: '相对时间',
  absolute: '绝对时间',
  inline: '行内',
  line: '独占行',
  auto: '自动',
  details: '详情',
  summary: '摘要',
}

const colorGroupZhLabels: Record<string, string> = {
  semantic: '语义标签',
  model: '模型',
  project: '项目',
  git: 'Git',
  context: '上下文',
  'usage-memory': '用量 / 内存',
  custom: '自定义',
}

const displayPresenceByItem: Partial<Record<HudDisplayItemId, TerminalHudDisplayBooleanKey>> = {
  model: 'showModel',
  project: 'showProject',
  addedDirs: 'showAddedDirs',
  contextBar: 'showContextBar',
  sessionTokens: 'showSessionTokens',
  usage: 'showUsage',
  promptCache: 'showPromptCache',
  memory: 'showMemoryUsage',
  environment: 'showEnvironment',
  tools: 'showTools',
  agents: 'showAgents',
  todos: 'showTodos',
  cost: 'showCost',
  duration: 'showDuration',
  speed: 'showSpeed',
  outputStyle: 'showOutputStyle',
  claudeCodeVersion: 'showClaudeCodeVersion',
  effortLevel: 'showEffortLevel',
  sessionTime: 'showSessionStartDate',
}

const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)

const namedColorCss: Record<string, string> = {
  dim: '#94a3b8',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  magenta: '#d946ef',
  cyan: '#22d3ee',
  brightBlue: '#60a5fa',
  brightMagenta: '#f472b6',
}

const hex = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')

const ansiIndexToHex = (value: number): string => {
  const index = Math.max(0, Math.min(255, Math.round(value)))
  const base = ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0', '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff']
  if (index < base.length) return base[index]
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    return `#${hex(level)}${hex(level)}${hex(level)}`
  }
  const offset = index - 16
  const levels = [0, 95, 135, 175, 215, 255]
  const red = levels[Math.floor(offset / 36) % 6]
  const green = levels[Math.floor(offset / 6) % 6]
  const blue = levels[offset % 6]
  return `#${hex(red)}${hex(green)}${hex(blue)}`
}

const colorValueToPickerHex = (value: TerminalHudColorValue | undefined, fallback = '#38bdf8'): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return ansiIndexToHex(value)
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback
  if (isHexColor(text)) return text
  if (namedColorCss[text]) return namedColorCss[text]
  const numeric = Number(text)
  return Number.isFinite(numeric) ? ansiIndexToHex(numeric) : fallback
}

const colorValueToCss = (value: TerminalHudColorValue | undefined, fallback = '#dbeafe'): string => colorValueToPickerHex(value, fallback)

const previewPercent = (value: number | null | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null
)

const contextPreviewPercent = (state: NormalizedHudState): number | null => {
  const direct = previewPercent(state.context.usedPercent)
  if (direct !== null) return direct
  const used = state.context.usedTokens
  const windowSize = state.context.windowSize
  return typeof used === 'number' && Number.isFinite(used) && typeof windowSize === 'number' && Number.isFinite(windowSize) && windowSize > 0
    ? previewPercent((used / windowSize) * 100)
    : null
}

const bandColorValue = (config: TerminalHudConfig, kind: 'context' | 'usage', percent: number | null): TerminalHudColorValue => {
  const bands = kind === 'context' ? config.colors.contextBands : config.colors.usageBands
  if (percent !== null) {
    const matched = [...bands].sort((left, right) => right.min - left.min).find((band) => percent >= band.min)
    if (matched) return matched.color
  }
  if (kind === 'context') {
    if (percent !== null && percent >= config.display.contextCriticalThreshold) return config.colors.critical
    if (percent !== null && percent >= config.display.contextWarningThreshold) return config.colors.warning
    return config.colors.context
  }
  if (percent !== null && config.display.usageThreshold > 0 && percent >= config.display.usageThreshold) return config.colors.usageWarning
  return config.colors.usage
}

const previewColorForItem = (item: HudDisplayItemId, config: TerminalHudConfig, state: NormalizedHudState): string => {
  switch (item) {
    case 'model': return colorValueToCss(config.colors.model)
    case 'project': return colorValueToCss(config.colors.project)
    case 'git': return colorValueToCss(config.colors.git)
    case 'contextBar':
    case 'contextValue': return colorValueToCss(bandColorValue(config, 'context', contextPreviewPercent(state)), colorValueToCss(config.colors.context))
    case 'usage':
    case 'memory': return colorValueToCss(bandColorValue(config, 'usage', previewPercent(state.usage.fiveHourUsedPercent ?? state.system.memoryUsedPercent)), colorValueToCss(config.colors.usage))
    case 'customLine': return colorValueToCss(config.colors.custom)
    case 'sessionTokens': return colorValueToCss(config.colors.labelValue)
    case 'activity':
    case 'tools':
    case 'agents':
    case 'todos': return colorValueToCss(config.colors.labelTitle)
    default: return colorValueToCss(config.colors.labelValue)
  }
}

type PreviewTextPart = { text: string; color: string }

const splitPreviewText = (text: string, pattern: RegExp, colorForMatch: (match: string) => string, fallbackColor: string): PreviewTextPart[] => {
  const parts: PreviewTextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const value = match[0]
    const index = match.index ?? 0
    if (index > cursor) parts.push({ text: text.slice(cursor, index), color: fallbackColor })
    parts.push({ text: value, color: colorForMatch(value) })
    cursor = index + value.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), color: fallbackColor })
  return parts.length ? parts : [{ text, color: fallbackColor }]
}

const previewPartsForItem = (item: HudDisplayItemId, text: string, config: TerminalHudConfig, state: NormalizedHudState): PreviewTextPart[] => {
  const fallback = previewColorForItem(item, config, state)
  if (item === 'git') {
    return splitPreviewText(text, /(git:|\+\d+|-\d+|[^\s()]+\*?)/g, (match) => {
      if (match === 'git:') return colorValueToCss(config.colors.git)
      if (match.startsWith('+')) return namedColorCss.green
      if (match.startsWith('-')) return namedColorCss.red
      return colorValueToCss(config.colors.gitBranch)
    }, fallback)
  }
  if (item === 'sessionTokens' || item === 'sessionTime' || item === 'activity' || item === 'tools' || item === 'agents' || item === 'todos') {
    return splitPreviewText(text, /(Tokens|in:|out:|cache:|Started:|Last reply:|Agents|Tools|Todos|Todo|All todos complete)/g, () => colorValueToCss(config.colors.labelTitle), colorValueToCss(config.colors.labelValue))
  }
  return [{ text, color: fallback }]
}

const presetPatch = (preset: TerminalHudPreset): Partial<TerminalHudConfig> => {
  if (preset === 'minimal') {
    return {
      preset,
      rows: [['model', 'contextValue'], ['activity']],
      display: {
        ...DEFAULT_TERMINAL_HUD_CONFIG.display,
        showAddedDirs: false,
        showContextBar: false,
        showSessionTokens: false,
        showAgents: false,
        showTodos: false,
      },
    }
  }
  if (preset === 'hud-plus-default') return { ...DEFAULT_TERMINAL_HUD_CONFIG, preset }
  return { preset }
}

export function TerminalHudPanel({ config, language, previewState, claudeContextWindowSize, onPatchSettings }: TerminalHudPanelProps) {
  const copy = language === 'zh-CN'
    ? {
        title: 'Terminal HUD',
        hint: '复刻 Claude HUD Plus 的终端 HUD Builder：实时预览、拖拽行配置、组件参数与颜色工作台。',
        enabled: '启用 Terminal HUD',
        preset: '预设',
        rowOverflow: '行溢出策略',
        maxWidth: '最大宽度',
        rows: '行配置',
        palette: '组件库',
        inspector: '组件参数',
        colors: '颜色配置',
        preview: '实时终端预览',
        json: 'JSON 配置',
        components: '组件',
        colorTab: '颜色',
        jsonTab: 'JSON',
        addRow: '新增行',
        removeRow: '删除行',
        addItem: '选择添加',
        removeItem: '移除',
        moveUp: '上移',
        moveDown: '下移',
        moveLeft: '左移',
        moveRight: '右移',
        selectHint: '从左侧组件库拖拽到任意行；选中预览/行里的组件后，可在右侧修改参数。',
        dropHint: '拖拽组件到这里',
        colorHint: '支持 hex、ANSI 颜色名或 0-255 色号；hex 值会同步显示颜色选择器。',
        bandHint: '拖动最小值阈值并修改颜色；预览区会按当前上下文/用量百分比实时套用。',
        jsonValid: 'JSON 有效，可应用。',
        jsonInvalid: 'JSON 无效',
        jsonChanged: '当前草稿与已保存配置不同。',
        applyJson: '验证并应用 JSON',
        resetDefault: '重置 HUD Plus 默认',
        selectedOnly: '只看当前组件颜色',
        searchColor: '搜索颜色项',
        addBand: '新增区间',
        delete: '删除',
        contextWindowPlaceholder: '270000，留空则从 Claude 配置移除',
        presets: { 'hud-plus-default': 'HUD Plus 默认', minimal: '极简', custom: '自定义' },
        overflow: { truncate: '截断', wrap: '换行' },
      }
    : {
        title: 'Terminal HUD',
        hint: 'Claude HUD Plus style Terminal HUD Builder with live preview, draggable rows, component inspector, activityLine, and color workbench.',
        enabled: 'Enable Terminal HUD',
        preset: 'Preset',
        rowOverflow: 'Row overflow',
        maxWidth: 'Max width',
        rows: 'Rows builder',
        palette: 'Component palette',
        inspector: 'Component inspector',
        colors: 'Color Workbench',
        preview: 'Live terminal preview',
        json: 'JSON / Validate',
        components: 'Components',
        colorTab: 'Colors',
        jsonTab: 'JSON',
        addRow: 'Add row',
        removeRow: 'Remove row',
        addItem: 'Select item',
        removeItem: 'Remove',
        moveUp: 'Up',
        moveDown: 'Down',
        moveLeft: 'Left',
        moveRight: 'Right',
        selectHint: 'Drag palette items into any row. Select a component in the preview/canvas to edit it on the right.',
        dropHint: 'Drop component here',
        colorHint: 'Supports hex, ANSI color names, or 0-255 color indexes. Hex values sync with a color picker.',
        bandHint: 'Drag the minimum threshold and edit colors. The preview applies current context/usage percentages live.',
        jsonValid: 'JSON is valid and ready to apply.',
        jsonInvalid: 'Invalid JSON',
        jsonChanged: 'Draft differs from saved config.',
        applyJson: 'Validate and apply JSON',
        resetDefault: 'Reset HUD Plus default',
        selectedOnly: 'Only current component colors',
        searchColor: 'Search colors',
        addBand: 'Add band',
        delete: 'Delete',
        contextWindowPlaceholder: '270000, leave blank to remove from Claude settings',
        presets: { 'hud-plus-default': 'HUD Plus default', minimal: 'Minimal', custom: 'Custom' },
        overflow: { truncate: 'Truncate', wrap: 'Wrap' },
      }

  const terminalItems = useMemo(() => terminalDisplayItemIds(), [])
  const terminalItemSet = useMemo(() => new Set(terminalItems), [terminalItems])
  const configuredItemSet = useMemo(() => new Set(config.rows.flat()), [config.rows])
  const groupedItems = useMemo(() => {
    return terminalItems.reduce<Record<string, HudDisplayItemId[]>>((groups, item) => {
      if (configuredItemSet.has(item)) return groups
      const category = DISPLAY_ITEM_REGISTRY[item]?.category ?? 'custom'
      groups[category] = [...(groups[category] ?? []), item]
      return groups
    }, {})
  }, [configuredItemSet, terminalItems])
  const previewLines = renderTerminalHudPreviewLines(previewState, config)
  const previewRows = config.enabled
    ? config.rows
      .map((row) => row
        .map((item) => {
          const text = renderTerminalHudItem(previewState, item, config)
          return text ? { item, text, parts: previewPartsForItem(item, text, config, previewState) } : null
        })
        .filter((part): part is { item: HudDisplayItemId; text: string; parts: PreviewTextPart[] } => Boolean(part)))
      .filter((row) => row.length > 0)
    : []
  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(config, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<BuilderWorkspace>('components')
  const [selection, setSelection] = useState<SelectionState>(() => ({ rowIndex: 3, itemIndex: 0, item: 'activity' }))
  const [colorSearch, setColorSearch] = useState('')
  const [selectedColorsOnly, setSelectedColorsOnly] = useState(false)
  const [syncedContextWindowSize, setSyncedContextWindowSize] = useState<string | null>(claudeContextWindowSize ?? null)
  const [contextWindowSyncStatus, setContextWindowSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle')
  const [palettePointerDrag, setPalettePointerDrag] = useState<PalettePointerDrag>(null)
  const [palettePointerTargetRow, setPalettePointerTargetRow] = useState<number | null>(null)
  const palettePointerDragRef = useRef<PalettePointerDragRef | null>(null)
  const palettePointerListenersRef = useRef<PalettePointerListeners | null>(null)
  const suppressPaletteClickRef = useRef(false)

  const removePalettePointerListeners = (): void => {
    const listeners = palettePointerListenersRef.current
    if (!listeners) return
    window.removeEventListener('pointermove', listeners.pointerMove)
    window.removeEventListener('pointerup', listeners.pointerEnd)
    window.removeEventListener('pointercancel', listeners.pointerCancel)
    window.removeEventListener('mousemove', listeners.mouseMove)
    window.removeEventListener('mouseup', listeners.mouseEnd)
    palettePointerListenersRef.current = null
  }

  useEffect(() => {
    setSyncedContextWindowSize(claudeContextWindowSize ?? null)
  }, [claudeContextWindowSize])

  useEffect(() => {
    setJsonDraft(JSON.stringify(config, null, 2))
    setJsonError(null)
  }, [config])

  useEffect(() => () => removePalettePointerListeners(), [])

  const patchTerminalHud = (patch: Partial<TerminalHudConfig>): void => {
    onPatchSettings({ terminalHud: mergeTerminalHudConfig(config, { ...patch, preset: patch.preset ?? 'custom' }) })
  }

  const replaceTerminalHud = (nextConfig: Partial<TerminalHudConfig>): void => {
    onPatchSettings({ terminalHud: mergeTerminalHudConfig(DEFAULT_TERMINAL_HUD_CONFIG, nextConfig) })
  }

  const patchDisplay = (display: Partial<TerminalHudConfig['display']>): void => {
    patchTerminalHud({ display: { ...config.display, ...display } })
  }

  const syncContextWindowSizeOverride = (value: string): void => {
    const normalized = value.trim()
    setSyncedContextWindowSize(normalized || null)
    setContextWindowSyncStatus('syncing')
    void setClaudeHudContextWindowSize(normalized).then((status) => {
      if (status) {
        setSyncedContextWindowSize(status.contextWindowSizeEnv)
        setContextWindowSyncStatus('synced')
      } else {
        setContextWindowSyncStatus('synced')
      }
    })
  }

  const patchContextWindowSizeOverride = (value: string): void => {
    const normalized = value.replace(/[^0-9]/g, '')
    patchDisplay({ contextWindowSizeOverride: normalized, contextWindowSizeOverrideManaged: true })
    syncContextWindowSizeOverride(normalized)
  }

  const patchColors = (colors: Partial<TerminalHudConfig['colors']>): void => {
    patchTerminalHud({ colors: { ...config.colors, ...colors } })
  }

  const patchActivityLine = (activityLine: Partial<TerminalHudConfig['activityLine']>): void => {
    patchTerminalHud({ activityLine: { ...config.activityLine, ...activityLine } })
  }

  const patchActivityItems = (items: Partial<TerminalHudConfig['activityLine']['items']>): void => {
    patchActivityLine({ items: { ...config.activityLine.items, ...items } })
  }

  const patchActivityWarnings = (warnings: Partial<TerminalHudConfig['activityLine']['warnings']>): void => {
    patchActivityLine({ warnings: { ...config.activityLine.warnings, ...warnings } })
  }

  const patchGitStatus = (gitStatus: Partial<TerminalHudConfig['gitStatus']>): void => {
    patchTerminalHud({ gitStatus: { ...config.gitStatus, ...gitStatus } })
  }

  const enableItemPresence = (item: HudDisplayItemId, nextConfig: TerminalHudConfig): TerminalHudConfig => {
    const displayKey = displayPresenceByItem[item]
    if (item === 'git') return { ...nextConfig, gitStatus: { ...nextConfig.gitStatus, enabled: true } }
    if (item === 'contextValue') return { ...nextConfig, display: { ...nextConfig.display, contextValue: nextConfig.display.contextValue ?? 'both' } }
    if (!displayKey) return nextConfig
    return { ...nextConfig, display: { ...nextConfig.display, [displayKey]: true } }
  }

  const patchRows = (rows: HudDisplayItemId[][], itemToEnable?: HudDisplayItemId): void => {
    const normalizedRows = rows.filter((row) => row.length > 0)
    const nextRows = normalizedRows.length ? normalizedRows : DEFAULT_TERMINAL_HUD_CONFIG.rows
    let nextConfig = mergeTerminalHudConfig(config, { rows: nextRows, preset: 'custom' })
    if (itemToEnable) nextConfig = enableItemPresence(itemToEnable, nextConfig)
    onPatchSettings({ terminalHud: nextConfig })
  }

  const addRow = (): void => patchRows([...config.rows, ['activity']], 'activity')
  const removeRow = (rowIndex: number): void => {
    patchRows(config.rows.filter((_, index) => index !== rowIndex))
    if (selection?.rowIndex === rowIndex) setSelection(null)
  }
  const moveRow = (rowIndex: number, direction: -1 | 1): void => {
    const target = rowIndex + direction
    if (target < 0 || target >= config.rows.length) return
    const rows = [...config.rows]
    const [row] = rows.splice(rowIndex, 1)
    rows.splice(target, 0, row)
    patchRows(rows)
    if (selection?.rowIndex === rowIndex) setSelection({ ...selection, rowIndex: target })
  }
  const addItemToRow = (rowIndex: number, item: HudDisplayItemId, beforeIndex?: number): void => {
    const rows = config.rows.map((row, index) => {
      if (index !== rowIndex || row.includes(item)) return row
      const next = [...row]
      next.splice(beforeIndex ?? next.length, 0, item)
      return next
    })
    patchRows(rows, item)
    setSelection({ rowIndex, itemIndex: beforeIndex ?? rows[rowIndex].length - 1, item })
  }
  const removeItemFromRow = (rowIndex: number, itemIndex: number): void => {
    const rows = config.rows.map((row, index) => index === rowIndex ? row.filter((_, innerIndex) => innerIndex !== itemIndex) : row)
    patchRows(rows)
    if (selection?.rowIndex === rowIndex && selection.itemIndex === itemIndex) setSelection(null)
  }
  const moveItem = (rowIndex: number, itemIndex: number, direction: -1 | 1): void => {
    const row = config.rows[rowIndex]
    const target = itemIndex + direction
    if (!row || target < 0 || target >= row.length) return
    const rows = config.rows.map((currentRow, index) => index === rowIndex ? [...currentRow] : currentRow)
    const [item] = rows[rowIndex].splice(itemIndex, 1)
    rows[rowIndex].splice(target, 0, item)
    patchRows(rows)
    setSelection({ rowIndex, itemIndex: target, item })
  }

  const dragPayload = (event: DragEvent): DragPayload | null => {
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/json')) as DragPayload
      return terminalItemSet.has(payload.item) ? payload : null
    } catch {
      return null
    }
  }

  const dropIntoRow = (event: DragEvent, rowIndex: number, beforeIndex?: number): void => {
    event.preventDefault()
    event.stopPropagation()
    const payload = dragPayload(event)
    if (!payload) return
    const rows = config.rows.map((row) => [...row])
    let insertIndex = beforeIndex ?? rows[rowIndex].length
    if (typeof payload.fromRow === 'number' && typeof payload.fromIndex === 'number') {
      if (!rows[payload.fromRow]?.[payload.fromIndex]) return
      rows[payload.fromRow].splice(payload.fromIndex, 1)
      if (payload.fromRow === rowIndex && payload.fromIndex < insertIndex) insertIndex -= 1
    } else if (rows.some((row) => row.includes(payload.item))) {
      return
    }
    rows[rowIndex].splice(Math.max(0, insertIndex), 0, payload.item)
    patchRows(rows, payload.item)
    setSelection({ rowIndex, itemIndex: Math.max(0, insertIndex), item: payload.item })
  }

  const validateJsonDraft = (): Partial<TerminalHudConfig> | null => {
    try {
      const parsed = JSON.parse(jsonDraft) as Partial<TerminalHudConfig>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be an object')
      if (parsed.rows && (!Array.isArray(parsed.rows) || parsed.rows.some((row) => !Array.isArray(row)))) throw new Error('rows must be an array of arrays')
      if (parsed.rows) {
        const unknown = parsed.rows.flat().filter((item) => typeof item !== 'string' || !terminalItemSet.has(item as HudDisplayItemId))
        if (unknown.length) throw new Error(`unknown row items: ${Array.from(new Set(unknown)).join(', ')}`)
      }
      if (parsed.display && (typeof parsed.display !== 'object' || Array.isArray(parsed.display))) throw new Error('display must be an object')
      if (parsed.colors && (typeof parsed.colors !== 'object' || Array.isArray(parsed.colors))) throw new Error('colors must be an object')
      setJsonError(null)
      return parsed
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const applyJsonDraft = (): void => {
    const parsed = validateJsonDraft()
    if (parsed) replaceTerminalHud(parsed)
  }

  const draftChanged = jsonDraft.trim() !== JSON.stringify(config, null, 2).trim()
  const selectedItem = selection?.item ?? null
  const selectedDefinition = selectedItem ? DISPLAY_ITEM_REGISTRY[selectedItem] : null
  const colorGroupFilter = selectedItem ? itemColorGroups[selectedItem] ?? [] : []

  const displayLabel = (key: TerminalHudDisplayBooleanKey): string => {
    const labels = language === 'zh-CN'
      ? {
          showModel: '模型', showProject: '项目', showAddedDirs: '附加目录', showContextBar: '上下文进度条', showConfigCounts: '配置计数', showSessionTokens: '会话 Token', showTokenBreakdown: 'Token 明细', showUsage: '用量', usageBarEnabled: '用量进度条', showResetLabel: '重置时间', usageCompact: '紧凑用量', showTools: '工具', showAgents: '子代理', showTodos: '任务', showPromptCache: 'Prompt 缓存', showMemoryUsage: '内存', showEnvironment: '环境', showCost: '成本', showDuration: '耗时', showSpeed: '速度', showOutputStyle: '输出风格', showSessionName: '会话名', showClaudeCodeVersion: 'Claude Code 版本', showEffortLevel: '思考强度', showSessionStartDate: '会话开始时间', showLastResponseAt: '最后回复时间', contextWindowSizeOverrideManaged: '托管上下文窗口',
        }
      : {
          showModel: 'Model', showProject: 'Project', showAddedDirs: 'Added dirs', showContextBar: 'Context bar', showConfigCounts: 'Config counts', showSessionTokens: 'Session tokens', showTokenBreakdown: 'Token breakdown', showUsage: 'Usage', usageBarEnabled: 'Usage bar', showResetLabel: 'Reset labels', usageCompact: 'Compact usage', showTools: 'Tools', showAgents: 'Agents', showTodos: 'Todos', showPromptCache: 'Prompt cache', showMemoryUsage: 'Memory', showEnvironment: 'Environment', showCost: 'Cost', showDuration: 'Duration', showSpeed: 'Speed', showOutputStyle: 'Output style', showSessionName: 'Session name', showClaudeCodeVersion: 'Claude Code version', showEffortLevel: 'Effort level', showSessionStartDate: 'Session start', showLastResponseAt: 'Last response', contextWindowSizeOverrideManaged: 'Manage context window size',
        }
    return labels[key] ?? key
  }

  const colorLabel = (key: keyof TerminalHudConfig['colors']): string => {
    const labels = language === 'zh-CN'
      ? { model: '模型', project: '项目', context: '上下文', usage: '用量', usageWarning: '用量警告', warning: '警告', critical: '严重', git: 'Git', gitBranch: 'Git 分支', label: '标签', labelTitle: '标签标题', labelValue: '标签值', custom: '自定义', barFilled: '填充', barEmpty: '空位' }
      : { model: 'Model', project: 'Project', context: 'Context', usage: 'Usage', usageWarning: 'Usage warning', warning: 'Warning', critical: 'Critical', git: 'Git', gitBranch: 'Git branch', label: 'Label', labelTitle: 'Label title', labelValue: 'Label value', custom: 'Custom', barFilled: 'Filled', barEmpty: 'Empty' }
    return labels[key as keyof typeof labels] ?? key
  }

  const itemDisplayLabel = (item: HudDisplayItemId): { primary: string; secondary: string } => {
    const definition = DISPLAY_ITEM_REGISTRY[item]
    const english = definition?.label ?? item
    return language === 'zh-CN'
      ? { primary: itemZhLabels[item] ?? english, secondary: english }
      : { primary: english, secondary: item }
  }

  const rowIndexFromPoint = (clientX: number, clientY: number): number | null => {
    const element = document.elementFromPoint(clientX, clientY)
    const rowElement = element?.closest<HTMLElement>('[data-terminal-row-index]')
    const value = rowElement?.dataset.terminalRowIndex
    if (value !== undefined) {
      const rowIndex = Number(value)
      return Number.isInteger(rowIndex) && rowIndex >= 0 ? rowIndex : null
    }
    const matchedRow = Array.from(document.querySelectorAll<HTMLElement>('[data-terminal-row-index]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    })
    const fallbackValue = matchedRow?.dataset.terminalRowIndex
    if (fallbackValue === undefined) return null
    const fallbackRowIndex = Number(fallbackValue)
    return Number.isInteger(fallbackRowIndex) && fallbackRowIndex >= 0 ? fallbackRowIndex : null
  }

  const movePalettePointerDrag = (event: PalettePointerEvent): void => {
    const drag = palettePointerDragRef.current
    if (!drag) return
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (!drag.active && distance < 4) return
    drag.active = true
    suppressPaletteClickRef.current = true
    event.preventDefault()
    const targetRow = rowIndexFromPoint(event.clientX, event.clientY)
    setPalettePointerTargetRow(targetRow)
    setPalettePointerDrag({ item: drag.item, label: drag.label, x: event.clientX, y: event.clientY, active: true })
  }

  const finishPalettePointerDrag = (event: PalettePointerEvent, cancelled = false): void => {
    const drag = palettePointerDragRef.current
    removePalettePointerListeners()
    palettePointerDragRef.current = null
    setPalettePointerDrag(null)
    setPalettePointerTargetRow(null)
    if (!drag?.active || cancelled) return
    event.preventDefault()
    event.stopPropagation()
    const targetRow = rowIndexFromPoint(event.clientX, event.clientY)
    if (targetRow !== null) addItemToRow(targetRow, drag.item)
  }

  const beginPaletteDrag = (clientX: number, clientY: number, item: HudDisplayItemId): void => {
    removePalettePointerListeners()
    const label = itemDisplayLabel(item)
    suppressPaletteClickRef.current = false
    palettePointerDragRef.current = {
      item,
      label: `${label.primary} · ${label.secondary}`,
      startX: clientX,
      startY: clientY,
      active: false,
    }
    const listeners: PalettePointerListeners = {
      pointerMove: movePalettePointerDrag,
      pointerEnd: (pointerEvent) => finishPalettePointerDrag(pointerEvent),
      pointerCancel: (pointerEvent) => finishPalettePointerDrag(pointerEvent, true),
      mouseMove: movePalettePointerDrag,
      mouseEnd: (mouseEvent) => finishPalettePointerDrag(mouseEvent),
    }
    palettePointerListenersRef.current = listeners
    window.addEventListener('pointermove', listeners.pointerMove, { passive: false })
    window.addEventListener('pointerup', listeners.pointerEnd, { passive: false })
    window.addEventListener('pointercancel', listeners.pointerCancel, { passive: false })
    window.addEventListener('mousemove', listeners.mouseMove, { passive: false })
    window.addEventListener('mouseup', listeners.mouseEnd, { passive: false })
  }

  const beginPalettePointerDrag = (event: ReactPointerEvent<HTMLElement>, item: HudDisplayItemId): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    beginPaletteDrag(event.clientX, event.clientY, item)
  }

  const beginPaletteMouseDrag = (event: ReactMouseEvent<HTMLElement>, item: HudDisplayItemId): void => {
    if (event.button !== 0) return
    beginPaletteDrag(event.clientX, event.clientY, item)
  }

  const configLabel = (key: string): string => language === 'zh-CN' ? (configZhLabels[key] ?? key) : key
  const enumLabel = (value: string): string => language === 'zh-CN' ? (enumZhLabels[value] ?? value) : value
  const categoryLabel = (category: string): string => language === 'zh-CN' ? (categoryZhLabels[category] ?? category) : category
  const kindLabel = (kind: string): string => language === 'zh-CN' ? (kindZhLabels[kind] ?? kind) : kind
  const colorGroupLabel = (group: { id: string; label: string }): string => language === 'zh-CN' ? (colorGroupZhLabels[group.id] ?? group.label) : group.label
  const contextWindowSyncLabel = (): string => {
    if (contextWindowSyncStatus === 'syncing') return language === 'zh-CN' ? '同步中…' : 'syncing…'
    if (contextWindowSyncStatus === 'synced') return language === 'zh-CN' ? '已同步' : 'synced'
    if (contextWindowSyncStatus === 'failed') return language === 'zh-CN' ? '同步失败，请重装最新版后重试' : 'sync failed, reinstall the latest version and retry'
    return language === 'zh-CN' ? '待输入' : 'idle'
  }

  const contextWindowHint = language === 'zh-CN'
    ? `输入后立即写入 Claude Code settings 的 env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE；清空会立即移除该环境变量。当前 Claude 配置：${syncedContextWindowSize ?? '未设置'}；同步状态：${contextWindowSyncLabel()}。修改后新一轮 statusLine 刷新会按该上下文窗口计算。`
    : `Writes env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE to Claude Code settings immediately; clearing it removes the env var. Current Claude setting: ${syncedContextWindowSize ?? 'not set'}; sync status: ${contextWindowSyncLabel()}. The next statusLine refresh uses this context window.`

  const renderSwitch = (key: TerminalHudDisplayBooleanKey) => (
    <label className="setting-check" key={key}>
      <input type="checkbox" checked={config.display[key] === true} onChange={(event) => patchDisplay({ [key]: event.currentTarget.checked } as Partial<TerminalHudConfig['display']>)} />
      <span>{displayLabel(key)}</span>
    </label>
  )

  const renderNumberField = (label: string, value: number | null, onChange: (value: number | null) => void, min?: number, max?: number, step = 1) => (
    <label className="setting-row setting-row--stacked">
      <span className="setting-row__label">{configLabel(label)}</span>
      <input type="number" value={value ?? ''} min={min} max={max} step={step} onChange={(event) => onChange(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} />
    </label>
  )

  const renderInlineNumberField = (label: string, value: number | null, onChange: (value: number | null) => void, min?: number, max?: number, step = 1) => (
    <label className="terminal-inline-number">
      <span className="setting-row__label">{label}</span>
      <input type="number" value={value ?? ''} min={min} max={max} step={step} aria-label={label} onChange={(event) => onChange(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} />
    </label>
  )

  const patchColorBands = (kind: 'context' | 'usage', nextBands: TerminalHudConfig['colors']['contextBands']): void => {
    const sorted = nextBands
      .map((band) => ({ min: Math.max(0, Math.min(100, Math.round(band.min))), color: band.color }))
      .sort((left, right) => left.min - right.min)
    if (kind === 'context') patchColors({ contextBands: sorted })
    else patchColors({ usageBands: sorted })
  }

  const renderBandEditor = (kind: 'context' | 'usage') => {
    const bands = kind === 'context' ? config.colors.contextBands : config.colors.usageBands
    const title = kind === 'context' ? configLabel('contextBands') : configLabel('usageBands')
    const fallbackColor = kind === 'context' ? config.colors.context : config.colors.usage
    return (
      <div className="terminal-band-editor">
        <div className="terminal-band-editor__head">
          <div>
            <h4>{title}</h4>
            <p className="settings-note">{copy.bandHint}</p>
          </div>
          <button className="secondary-button" onClick={() => patchColorBands(kind, [...bands, { min: bands.at(-1)?.min ?? 0, color: fallbackColor }])}>{copy.addBand}</button>
        </div>
        <div className="terminal-band-list">
          {bands.length ? bands.map((band, index) => (
            <div className="terminal-band-row" key={`${kind}-${index}`}>
              <label className="setting-slider">
                <span className="setting-slider__head"><span>{configLabel('min')}</span><strong>{band.min}%</strong></span>
                <input type="range" min="0" max="100" step="1" value={band.min} onChange={(event) => {
                  const next = [...bands]
                  next[index] = { ...band, min: Number(event.currentTarget.value) }
                  patchColorBands(kind, next)
                }} />
              </label>
              <label className="terminal-color-field terminal-color-field--band">
                <span className="terminal-color-field__label"><span className="terminal-color-swatch" style={{ background: colorValueToCss(band.color) }} />{configLabel('color')}</span>
                <input type="color" value={colorValueToPickerHex(band.color)} onChange={(event) => {
                  const next = [...bands]
                  next[index] = { ...band, color: event.currentTarget.value }
                  patchColorBands(kind, next)
                }} />
                <input value={String(band.color)} onChange={(event) => {
                  const next = [...bands]
                  next[index] = { ...band, color: event.currentTarget.value }
                  patchColorBands(kind, next)
                }} />
              </label>
              <button className="secondary-button" onClick={() => patchColorBands(kind, bands.filter((_, innerIndex) => innerIndex !== index))}>{copy.delete}</button>
            </div>
          )) : <p className="settings-note">{language === 'zh-CN' ? '未配置区间颜色，当前使用阈值和基础颜色。' : 'No color bands configured. Threshold and base colors are used.'}</p>}
        </div>
      </div>
    )
  }

  const renderInspector = () => {
    if (!selectedItem || !selectedDefinition) {
      return <p className="settings-note">{copy.selectHint}</p>
    }

    const presenceKey = selectedItem === 'sessionTime' ? undefined : displayPresenceByItem[selectedItem]

    return (
      <div className="terminal-inspector">
        <div className="terminal-inspector__title">
          <strong>{itemDisplayLabel(selectedItem).primary}</strong>
          <span>{itemDisplayLabel(selectedItem).secondary} · {kindLabel(selectedDefinition.kind)} · {categoryLabel(selectedDefinition.category)}</span>
        </div>
        {presenceKey ? renderSwitch(presenceKey) : null}
        {selectedItem === 'git' ? (
          <>
            <label className="setting-check"><input type="checkbox" checked={config.gitStatus.enabled} onChange={(event) => patchGitStatus({ enabled: event.currentTarget.checked })} /><span>{configLabel('gitStatus.enabled')}</span></label>
            <label className="setting-check"><input type="checkbox" checked={config.gitStatus.showDirty} onChange={(event) => patchGitStatus({ showDirty: event.currentTarget.checked })} /><span>{configLabel('showDirty')}</span></label>
            <label className="setting-check"><input type="checkbox" checked={config.gitStatus.showAheadBehind} onChange={(event) => patchGitStatus({ showAheadBehind: event.currentTarget.checked })} /><span>{configLabel('showAheadBehind')}</span></label>
            <label className="setting-check"><input type="checkbox" checked={config.gitStatus.showFileStats} onChange={(event) => patchGitStatus({ showFileStats: event.currentTarget.checked })} /><span>{configLabel('showFileStats')}</span></label>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('branchOverflow')}</span><select value={config.gitStatus.branchOverflow} onChange={(event) => patchGitStatus({ branchOverflow: event.currentTarget.value as TerminalHudConfig['gitStatus']['branchOverflow'] })}>{branchOverflowModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            {renderNumberField('pushWarningThreshold', config.gitStatus.pushWarningThreshold, (value) => patchGitStatus({ pushWarningThreshold: value ?? 0 }), 0, 999)}
            {renderNumberField('pushCriticalThreshold', config.gitStatus.pushCriticalThreshold, (value) => patchGitStatus({ pushCriticalThreshold: value ?? 0 }), 0, 999)}
          </>
        ) : null}
        {(selectedItem === 'contextBar' || selectedItem === 'contextValue') ? (
          <>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('contextValue')}</span><select value={config.display.contextValue} onChange={(event) => patchDisplay({ contextValue: event.currentTarget.value as TerminalHudConfig['display']['contextValue'] })}>{contextValueModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('autocompactBuffer')}</span><select value={config.display.autocompactBuffer} onChange={(event) => patchDisplay({ autocompactBuffer: event.currentTarget.value as TerminalHudConfig['display']['autocompactBuffer'] })}>{(['enabled', 'disabled'] as const).map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            {renderNumberField('contextWarningThreshold', config.display.contextWarningThreshold, (value) => patchDisplay({ contextWarningThreshold: value ?? DEFAULT_TERMINAL_HUD_CONFIG.display.contextWarningThreshold }), 0, 100)}
            {renderNumberField('contextCriticalThreshold', config.display.contextCriticalThreshold, (value) => patchDisplay({ contextCriticalThreshold: value ?? DEFAULT_TERMINAL_HUD_CONFIG.display.contextCriticalThreshold }), 0, 100)}
          </>
        ) : null}
        {selectedItem === 'project' ? (
          <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('pathLevels')}</span><select value={config.pathLevels} onChange={(event) => patchTerminalHud({ pathLevels: Number(event.currentTarget.value) as TerminalHudConfig['pathLevels'] })}>{([1, 2, 3] as const).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
        ) : null}
        {selectedItem === 'model' ? (
          <>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('modelFormat')}</span><select value={config.display.modelFormat} onChange={(event) => patchDisplay({ modelFormat: event.currentTarget.value as TerminalHudConfig['display']['modelFormat'] })}>{modelFormatModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('modelOverride')}</span><input value={config.display.modelOverride} onChange={(event) => patchDisplay({ modelOverride: event.currentTarget.value })} /></label>
            <label className="setting-row setting-row--stacked">
              <span className="setting-row__label">{configLabel('contextWindowSizeOverride')}</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={copy.contextWindowPlaceholder}
                value={(config.display.contextWindowSizeOverride || syncedContextWindowSize || '')}
                onChange={(event) => patchContextWindowSizeOverride(event.currentTarget.value)}
              />
              <span className="setting-row__hint">{contextWindowHint}</span>
            </label>
            {renderSwitch('showEffortLevel')}
          </>
        ) : null}
        {selectedItem === 'sessionTokens' ? (
          <>
            {renderSwitch('showTokenBreakdown')}
            {renderSwitch('showSessionStartDate')}
            {renderSwitch('showLastResponseAt')}
          </>
        ) : null}
        {selectedItem === 'sessionTime' ? (
          <>
            {renderSwitch('showSessionStartDate')}
            {renderSwitch('showLastResponseAt')}
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('timeFormat')}</span><select value={config.display.timeFormat} onChange={(event) => patchDisplay({ timeFormat: event.currentTarget.value as TerminalHudConfig['display']['timeFormat'] })}>{timeFormatModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
          </>
        ) : null}
        {selectedItem === 'usage' ? (
          <>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('usageValue')}</span><select value={config.display.usageValue} onChange={(event) => patchDisplay({ usageValue: event.currentTarget.value as TerminalHudConfig['display']['usageValue'] })}>{usageValueModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            {renderSwitch('usageBarEnabled')}
            {renderSwitch('usageCompact')}
            {renderSwitch('showResetLabel')}
            {renderNumberField('usageThreshold', config.display.usageThreshold, (value) => patchDisplay({ usageThreshold: value ?? 0 }), 0, 100)}
            {renderNumberField('sevenDayThreshold', config.display.sevenDayThreshold, (value) => patchDisplay({ sevenDayThreshold: value ?? DEFAULT_TERMINAL_HUD_CONFIG.display.sevenDayThreshold }), 0, 100)}
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('timeFormat')}</span><select value={config.display.timeFormat} onChange={(event) => patchDisplay({ timeFormat: event.currentTarget.value as TerminalHudConfig['display']['timeFormat'] })}>{timeFormatModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
          </>
        ) : null}
        {selectedItem === 'addedDirs' ? (
          <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('addedDirsLayout')}</span><select value={config.display.addedDirsLayout} onChange={(event) => patchDisplay({ addedDirsLayout: event.currentTarget.value as TerminalHudConfig['display']['addedDirsLayout'] })}>{addedDirsLayouts.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
        ) : null}
        {selectedItem === 'promptCache' ? renderNumberField('promptCacheTtlSeconds', config.display.promptCacheTtlSeconds, (value) => patchDisplay({ promptCacheTtlSeconds: value ?? DEFAULT_TERMINAL_HUD_CONFIG.display.promptCacheTtlSeconds }), 1, 3600) : null}
        {selectedItem === 'environment' ? (
          <>
            {renderSwitch('showConfigCounts')}
            {renderSwitch('showOutputStyle')}
            {renderNumberField('environmentThreshold', config.display.environmentThreshold, (value) => patchDisplay({ environmentThreshold: value ?? 0 }), 0, 100)}
          </>
        ) : null}
        {selectedItem === 'customLine' ? <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('customLine')}</span><input value={config.display.customLine} onChange={(event) => patchDisplay({ customLine: event.currentTarget.value })} /></label> : null}
        {selectedItem === 'activity' ? (
          <>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('activityLine.mode')}</span><select value={config.activityLine.mode} onChange={(event) => patchActivityLine({ mode: event.currentTarget.value as TerminalHudConfig['activityLine']['mode'] })}>{activityModes.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            <label className="setting-row setting-row--stacked"><span className="setting-row__label">{configLabel('toolNameFormat')}</span><select value={config.activityLine.toolNameFormat} onChange={(event) => patchActivityLine({ toolNameFormat: event.currentTarget.value as TerminalHudConfig['activityLine']['toolNameFormat'] })}>{toolNameFormats.map((mode) => <option key={mode} value={mode}>{enumLabel(mode)}</option>)}</select></label>
            <label className="setting-slider"><span className="setting-slider__head"><span>{configLabel('maxWidthRatio')}</span><strong>{config.activityLine.maxWidthRatio.toFixed(2)}</strong></span><input type="range" min="0.3" max="1" step="0.05" value={config.activityLine.maxWidthRatio} onChange={(event) => patchActivityLine({ maxWidthRatio: Number(event.currentTarget.value) })} /></label>
            <div className="terminal-inspector__subgrid">
              {(['todos', 'agents', 'tools', 'sessionTime'] as const).map((key) => <label className="setting-check" key={key}><input type="checkbox" checked={config.activityLine.items[key] !== false} onChange={(event) => patchActivityItems({ [key]: event.currentTarget.checked })} /><span>{configLabel(`items.${key}`)}</span></label>)}
            </div>
            <div className="terminal-inspector__subgrid">
              {(['usage', 'memory', 'environment', 'promptCache'] as const).map((key) => <label className="setting-check" key={key}><input type="checkbox" checked={config.activityLine.warnings[key] !== false} onChange={(event) => patchActivityWarnings({ [key]: event.currentTarget.checked })} /><span>{configLabel(`warnings.${key}`)}</span></label>)}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  const filteredColorGroups = colorGroups
    .filter((group) => !selectedColorsOnly || colorGroupFilter.includes(group.id))
    .map((group) => ({ ...group, items: group.items.filter((item) => `${colorGroupLabel(group)} ${group.label} ${item} ${colorLabel(item)}`.toLowerCase().includes(colorSearch.trim().toLowerCase())) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="settings-tab-panel terminal-builder" role="tabpanel">
      <div className="terminal-builder__topbar">
        <section className="terminal-builder__hero">
        <div className="settings-section__heading">
          <h3>{copy.title}</h3>
          <p>{copy.hint}</p>
        </div>
        <div className="terminal-preview terminal-preview--hero terminal-preview--rich" aria-label="Terminal HUD preview">
          {previewRows.length ? previewRows.map((row, rowIndex) => (
            <div className="terminal-preview__line" key={`preview-${rowIndex}`}>
              {row.map((part, partIndex) => (
                <span key={`${part.item}-${partIndex}`}>
                  {partIndex > 0 ? (config.showSeparators ? ' │ ' : ' ') : ''}
                  {part.parts.map((textPart, textPartIndex) => (
                    <span key={`${part.item}-${partIndex}-${textPartIndex}`} style={{ color: textPart.color }}>{textPart.text}</span>
                  ))}
                </span>
              ))}
            </div>
          )) : <span>{previewLines.join('\n')}</span>}
        </div>
        <div className="terminal-builder__hero-actions">
          <label className="setting-check setting-check--inline">
            <input type="checkbox" checked={config.enabled} onChange={(event) => patchTerminalHud({ enabled: event.currentTarget.checked })} />
            <span>{copy.enabled}</span>
          </label>
          <div className="option-group option-group--wide">
            {terminalPresets.map((preset) => <button key={preset} className={config.preset === preset ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchTerminalHud(presetPatch(preset))}>{copy.presets[preset]}</button>)}
          </div>
        </div>
      </section>

        <div className="terminal-builder__tabs" role="tablist">
          {([
            ['components', copy.components],
            ['colors', copy.colorTab],
            ['json', copy.jsonTab],
          ] as Array<[BuilderWorkspace, string]>).map(([key, label]) => (
            <button key={key} className={workspace === key ? 'terminal-builder__tab terminal-builder__tab--active' : 'terminal-builder__tab'} onClick={() => setWorkspace(key)}>{label}</button>
          ))}
        </div>
      </div>

      {palettePointerDrag?.active ? (
        <div className="terminal-drag-ghost" style={{ left: palettePointerDrag.x, top: palettePointerDrag.y }}>{palettePointerDrag.label}</div>
      ) : null}

      {workspace === 'components' ? (
        <section className="terminal-workspace terminal-workspace--components">
          <aside className="terminal-builder-card terminal-palette-panel">
            <div className="terminal-builder-card__head"><h4>{copy.palette}</h4><p>{copy.selectHint}</p></div>
            <div className="terminal-card-scroll terminal-palette-scroll">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div className="terminal-palette-group" key={category}>
                  <strong>{categoryLabel(category)}</strong>
                  <div className="terminal-palette-grid">
                    {items.map((item) => {
                      const label = itemDisplayLabel(item)
                      return (
                        <button
                          key={item}
                          className={selectedItem === item ? 'terminal-palette-item terminal-palette-item--selected' : 'terminal-palette-item'}
                          aria-label={`${label.primary} ${label.secondary}`}
                          onPointerDown={(event) => beginPalettePointerDrag(event, item)}
                          onMouseDown={(event) => beginPaletteMouseDrag(event, item)}
                          onClick={(event) => {
                            if (suppressPaletteClickRef.current) {
                              suppressPaletteClickRef.current = false
                              event.preventDefault()
                              return
                            }
                            setSelection({ rowIndex: -1, itemIndex: -1, item })
                          }}
                        >
                          <span>{label.primary}</span>
                          <em>{label.secondary}</em>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="terminal-builder-card terminal-canvas-panel">
            <div className="terminal-builder-card__head">
              <h4>{copy.rows}</h4>
              <div className="terminal-builder-card__actions">
                <div className="option-group">
                  {rowOverflowModes.map((rowOverflow) => <button key={rowOverflow} className={config.rowOverflow === rowOverflow ? 'option-pill option-pill--active' : 'option-pill'} onClick={() => patchTerminalHud({ rowOverflow })}>{copy.overflow[rowOverflow]}</button>)}
                </div>
                {renderInlineNumberField(copy.maxWidth, config.maxWidth, (value) => patchTerminalHud({ maxWidth: value && value > 0 ? value : null }), 20, 240)}
              </div>
            </div>
            <div className="terminal-row-builder terminal-row-builder--canvas">
              {config.rows.map((row, rowIndex) => (
                <div className="terminal-row-builder__row terminal-row-builder__row--canvas" key={`${rowIndex}-${row.join('-')}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropIntoRow(event, rowIndex)}>
                  <div className="terminal-row-builder__row-head">
                    <strong>{language === 'zh-CN' ? `第 ${rowIndex + 1} 行` : `row ${rowIndex + 1}`}</strong>
                    <div className="terminal-row-builder__row-actions">
                      <button className="secondary-button" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0}>{copy.moveUp}</button>
                      <button className="secondary-button" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === config.rows.length - 1}>{copy.moveDown}</button>
                      <button className="secondary-button" onClick={() => removeRow(rowIndex)}>{copy.removeRow}</button>
                    </div>
                  </div>
                  <div
                    className={palettePointerTargetRow === rowIndex ? 'terminal-row-builder__items terminal-row-builder__items--dropzone terminal-row-builder__items--pointer-target' : 'terminal-row-builder__items terminal-row-builder__items--dropzone'}
                    data-terminal-row-index={rowIndex}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropIntoRow(event, rowIndex)}
                  >
                    {row.map((item, itemIndex) => {
                      const label = itemDisplayLabel(item)
                      return (
                        <div
                          className={selection?.rowIndex === rowIndex && selection.itemIndex === itemIndex ? 'terminal-item-chip terminal-item-chip--selected' : 'terminal-item-chip'}
                          key={`${item}-${itemIndex}`}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('application/json', JSON.stringify({ item, fromRow: rowIndex, fromIndex: itemIndex }))
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => dropIntoRow(event, rowIndex, itemIndex)}
                          onClick={() => setSelection({ rowIndex, itemIndex, item })}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelection({ rowIndex, itemIndex, item }) }}
                        >
                          <span>{label.primary}</span>
                          <em>{label.secondary}</em>
                          <span className="terminal-item-chip__actions">
                            <button type="button" className="terminal-chip-action" onClick={(event) => { event.stopPropagation(); moveItem(rowIndex, itemIndex, -1) }}>{copy.moveLeft}</button>
                            <button type="button" className="terminal-chip-action" onClick={(event) => { event.stopPropagation(); moveItem(rowIndex, itemIndex, 1) }}>{copy.moveRight}</button>
                            <button type="button" className="terminal-chip-action" onClick={(event) => { event.stopPropagation(); removeItemFromRow(rowIndex, itemIndex) }}>×</button>
                          </span>
                        </div>
                      )
                    })}
                    <span className="terminal-row-builder__drop-hint">{copy.dropHint}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="secondary-button" onClick={addRow}>{copy.addRow}</button>
          </main>

          <aside className="terminal-builder-card terminal-inspector-panel">
            <div className="terminal-builder-card__head"><h4>{copy.inspector}</h4></div>
            {renderInspector()}
          </aside>
        </section>
      ) : null}

      {workspace === 'colors' ? (
        <section className="terminal-workspace terminal-workspace--colors">
          <div className="terminal-builder-card terminal-color-panel">
            <div className="terminal-builder-card__head"><h4>{copy.colors}</h4><p>{copy.colorHint}</p></div>
            <div className="terminal-color-toolbar">
              <input value={colorSearch} placeholder={copy.searchColor} onChange={(event) => setColorSearch(event.currentTarget.value)} />
              <label className="setting-check setting-check--inline"><input type="checkbox" checked={selectedColorsOnly} onChange={(event) => setSelectedColorsOnly(event.currentTarget.checked)} /><span>{copy.selectedOnly}</span></label>
            </div>
            {filteredColorGroups.map((group) => (
              <div className="terminal-color-group" key={group.id}>
                <h4>{colorGroupLabel(group)}</h4>
                <div className="terminal-color-grid terminal-color-grid--workbench">
                  {group.items.map((key) => {
                    const value = config.colors[key]
                    const textValue = String(value ?? '')
                    return (
                      <label className="terminal-color-field terminal-color-field--workbench" key={key}>
                        <span className="terminal-color-field__label"><span className="terminal-color-swatch" style={{ background: colorValueToCss(value) }} />{colorLabel(key)}</span>
                        <input type="color" value={colorValueToPickerHex(value)} onChange={(event) => patchColors({ [key]: event.currentTarget.value })} />
                        <input value={textValue} placeholder="#22D3EE / brightBlue / 208" onChange={(event) => patchColors({ [key]: event.currentTarget.value })} />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            {selectedColorsOnly && selectedItem && !['contextBar', 'contextValue', 'usage', 'memory'].includes(selectedItem) ? null : renderBandEditor('context')}
            {selectedColorsOnly && selectedItem && !['usage', 'memory'].includes(selectedItem) ? null : renderBandEditor('usage')}
            <div className="setting-group">
              <span className="setting-row__label">{configLabel('barCharacters')}</span>
              <div className="settings-check-grid settings-check-grid--compact">
                {barKeys.map((key) => <label className="setting-row setting-row--stacked" key={key}><span className="setting-row__label">{colorLabel(key)}</span><input className="terminal-char-input" value={config.colors[key]} maxLength={2} onChange={(event) => patchColors({ [key]: event.currentTarget.value.slice(0, 2) })} /></label>)}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {workspace === 'json' ? (
        <section className="terminal-workspace terminal-workspace--json">
          <div className="terminal-builder-card terminal-json-panel">
            <div className="terminal-builder-card__head"><h4>{copy.json}</h4></div>
            <textarea className="terminal-json-editor" value={jsonDraft} onChange={(event) => setJsonDraft(event.currentTarget.value)} spellCheck={false} aria-label="Terminal HUD JSON editor" />
            <p className="settings-note">{jsonError ? `${copy.jsonInvalid}: ${jsonError}` : draftChanged ? copy.jsonChanged : copy.jsonValid}</p>
            <div className="settings-actions settings-actions--grid">
              <button className="secondary-button" onClick={applyJsonDraft}>{copy.applyJson}</button>
              <button className="secondary-button" onClick={() => replaceTerminalHud(DEFAULT_TERMINAL_HUD_CONFIG)}>{copy.resetDefault}</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
