import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { freemem, totalmem } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv.includes('--hook') ? 'hook' : 'statusLine'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..', '..')
const PROJECT_STATE_PATH = resolve(SCRIPT_DIR, 'state', 'claude-status.json')
const PROJECT_SESSIONS_DIR = resolve(SCRIPT_DIR, 'state', 'sessions')
const APPDATA_STATE_PATH = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Claude HUD One', 'claude-status.json')
  : null
const APPDATA_SESSIONS_DIR = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Claude HUD One', 'sessions')
  : null
const APPDATA_SETTINGS_PATH = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Claude HUD One', 'settings.json')
  : null
const CLAUDE_SETTINGS_PATH = (() => {
  const configDir = typeof process.env.CLAUDE_CONFIG_DIR === 'string' ? process.env.CLAUDE_CONFIG_DIR.split(',')[0]?.trim() : ''
  if (configDir) return resolve(configDir, 'settings.json')
  if (process.env.USERPROFILE) return resolve(process.env.USERPROFILE, '.claude', 'settings.json')
  if (process.env.HOME) return resolve(process.env.HOME, '.claude', 'settings.json')
  return null
})()
const RUNNING_HOOK_HOLD_MS = Number(process.env.CLAUDE_HUD_ONE_RUNNING_HOOK_HOLD_MS ?? 15 * 60_000)
const TERMINAL_HOOK_HOLD_MS = Number(process.env.CLAUDE_HUD_ONE_TERMINAL_HOOK_HOLD_MS ?? 8_000)

const FALLBACK_STATUS = 'Claude HUD One'
let completed = false

const complete = (statusText = FALLBACK_STATUS) => {
  if (completed) return
  completed = true
  if (MODE === 'statusLine') process.stdout.write(statusText)
  process.exit(0)
}

const failSafe = setTimeout(() => complete(FALLBACK_STATUS), 2_700)
failSafe.unref?.()

const readStdin = async () => {
  const chunks = []
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) chunks.push(chunk)
  return chunks.join('')
}

const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const stringOrNull = (value) => typeof value === 'string' && value.length > 0 ? value : null
const boolOrNull = (value) => typeof value === 'boolean' ? value : null
const millisOrNull = (value) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

const baseName = (value) => {
  if (!value || typeof value !== 'string') return null
  const normalized = value.replaceAll('\\', '/')
  return normalized.split('/').filter(Boolean).at(-1) ?? null
}

const safeFileName = (value) => {
  const text = stringOrNull(value)
  if (!text) return null
  const safe = text
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safe.length > 0 ? safe.slice(0, 120) : null
}

const compactPercent = (value) => {
  const number = numberOrNull(value)
  if (number === null) return null
  return Math.max(0, Math.min(100, Math.round(number)))
}

const positiveNumberOrNull = (value) => {
  const number = numberOrNull(value)
  return number !== null && number > 0 ? number : null
}

const sumPositive = (...values) => {
  const numbers = values.map(positiveNumberOrNull).filter((value) => value !== null)
  if (numbers.length === 0) return null
  return numbers.reduce((sum, value) => sum + value, 0)
}

const sumNonNegative = (...values) => {
  const numbers = values.map(numberOrNull).filter((value) => value !== null && value >= 0)
  if (numbers.length === 0) return null
  return numbers.reduce((sum, value) => sum + value, 0)
}

const formatTokenK = (tokens, allowZero = false) => {
  const number = numberOrNull(tokens)
  if (number === null || number < 0 || (!allowZero && number === 0)) return null
  if (number === 0) return '0'
  if (number < 1_000) return `${Math.round(number)} tokens`
  if (number < 10_000) return `${(number / 1_000).toFixed(1)}K`
  if (number < 1_000_000) return `${Math.round(number / 1_000)}K`
  return `${(number / 1_000_000).toFixed(1)}M`
}

const nonNegativeIntegerOrNull = (value) => {
  const number = numberOrNull(value)
  return number !== null && number >= 0 ? Math.round(number) : null
}

const firstCount = (...values) => {
  for (const value of values) {
    const count = nonNegativeIntegerOrNull(value)
    if (count !== null) return count
  }
  return null
}

const safeIsoString = (value) => {
  const timestamp = millisOrNull(value)
  return timestamp === null ? null : new Date(timestamp).toISOString()
}

const sanitizeAddedDirs = (workspace) => {
  const dirs = Array.isArray(workspace?.added_dirs) ? workspace.added_dirs : []
  const slugs = []
  for (const dir of dirs) {
    const slug = baseName(stringOrNull(dir))
    if (slug && !slugs.includes(slug)) slugs.push(slug)
    if (slugs.length >= 4) break
  }
  return {
    addedDirSlugs: slugs,
    addedDirsOverflowCount: Math.max(0, dirs.length - slugs.length),
  }
}

const gitTimeoutMs = () => {
  const value = Number(process.env.CLAUDE_HUD_ONE_GIT_TIMEOUT_MS ?? 180)
  return Number.isFinite(value) ? value : 180
}

const gitOutput = (cwd, args) => {
  const dir = stringOrNull(cwd)
  if (!dir || process.env.CLAUDE_HUD_ONE_GIT_STATUS === '0') return null
  try {
    const result = spawnSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      timeout: Math.max(40, gitTimeoutMs()),
      windowsHide: true,
    })
    if (result.status !== 0) return null
    return stringOrNull(result.stdout?.trim())
  } catch {
    return null
  }
}

const readGitSummary = (cwd) => {
  const branch = gitOutput(cwd, ['branch', '--show-current'])
    ?? gitOutput(cwd, ['rev-parse', '--short', 'HEAD'])
  if (!branch) return {}
  const status = gitOutput(cwd, ['status', '--short', '--branch'])
  const firstLine = status?.split(/\r?\n/)[0] ?? ''
  const ahead = /ahead (\d+)/.exec(firstLine)?.[1]
  const behind = /behind (\d+)/.exec(firstLine)?.[1]
  const dirty = Boolean(status?.split(/\r?\n/).slice(1).some((line) => line.trim().length > 0))
  return {
    gitBranch: branch.length > 40 ? `${branch.slice(0, 39)}…` : branch,
    gitDirty: dirty,
    gitAhead: nonNegativeIntegerOrNull(ahead),
    gitBehind: nonNegativeIntegerOrNull(behind),
  }
}

const readMemorySummary = () => {
  const total = totalmem()
  const free = freemem()
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(free)) return {}
  const used = Math.max(0, total - free)
  return {
    memoryUsedBytes: used,
    memoryTotalBytes: total,
    memoryUsedPercent: Math.round((used / total) * 100),
  }
}

const dirEntryCount = (path) => {
  try {
    return existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((entry) => !entry.name.startsWith('.')).length : 0
  } catch {
    return 0
  }
}

const fileExistsCount = (paths) => paths.reduce((count, path) => count + (path && existsSync(path) ? 1 : 0), 0)

const readEnvironmentSummary = (cwd) => {
  const homeClaude = process.env.USERPROFILE ? resolve(process.env.USERPROFILE, '.claude') : null
  const projectClaude = cwd ? join(cwd, '.claude') : null
  const claudeMdCount = fileExistsCount([
    homeClaude ? join(homeClaude, 'CLAUDE.md') : null,
    cwd ? join(cwd, 'CLAUDE.md') : null,
  ])
  const rulesCount = (homeClaude ? dirEntryCount(join(homeClaude, 'rules')) : 0)
    + (projectClaude ? dirEntryCount(join(projectClaude, 'rules')) : 0)
  const mcpCount = fileExistsCount([
    homeClaude ? join(homeClaude, '.mcp.json') : null,
    cwd ? join(cwd, '.mcp.json') : null,
  ])
  const hooksCount = fileExistsCount([
    homeClaude ? join(homeClaude, 'settings.json') : null,
    projectClaude ? join(projectClaude, 'settings.json') : null,
  ])
  return { claudeMdCount, rulesCount, mcpCount, hooksCount }
}

const DEFAULT_TERMINAL_HUD_CONFIG = {
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
    items: { todos: true, agents: true, tools: true, sessionTime: false },
    warnings: { usage: false, memory: false, environment: false, promptCache: false },
  },
  showSeparators: false,
  pathLevels: 1,
  maxWidth: null,
  elementOrder: ['project', 'addedDirs', 'context', 'usage', 'promptCache', 'memory', 'environment', 'tools', 'agents', 'todos', 'sessionTime'],
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
    mergeGroups: [['context', 'usage']],
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

const mergeTerminalHudConfig = (config) => ({
  ...DEFAULT_TERMINAL_HUD_CONFIG,
  ...(config && typeof config === 'object' ? config : {}),
  rows: Array.isArray(config?.rows) ? config.rows : DEFAULT_TERMINAL_HUD_CONFIG.rows,
  elementOrder: Array.isArray(config?.elementOrder) ? config.elementOrder : DEFAULT_TERMINAL_HUD_CONFIG.elementOrder,
  activityLine: {
    ...DEFAULT_TERMINAL_HUD_CONFIG.activityLine,
    ...(config?.activityLine && typeof config.activityLine === 'object' ? config.activityLine : {}),
    items: {
      ...DEFAULT_TERMINAL_HUD_CONFIG.activityLine.items,
      ...(config?.activityLine?.items && typeof config.activityLine.items === 'object' ? config.activityLine.items : {}),
    },
    warnings: {
      ...DEFAULT_TERMINAL_HUD_CONFIG.activityLine.warnings,
      ...(config?.activityLine?.warnings && typeof config.activityLine.warnings === 'object' ? config.activityLine.warnings : {}),
    },
  },
  gitStatus: {
    ...DEFAULT_TERMINAL_HUD_CONFIG.gitStatus,
    ...(config?.gitStatus && typeof config.gitStatus === 'object' ? config.gitStatus : {}),
  },
  colors: {
    ...DEFAULT_TERMINAL_HUD_CONFIG.colors,
    ...(config?.colors && typeof config.colors === 'object' ? config.colors : {}),
    contextBands: Array.isArray(config?.colors?.contextBands) ? config.colors.contextBands : DEFAULT_TERMINAL_HUD_CONFIG.colors.contextBands,
    usageBands: Array.isArray(config?.colors?.usageBands) ? config.colors.usageBands : DEFAULT_TERMINAL_HUD_CONFIG.colors.usageBands,
  },
  display: {
    ...DEFAULT_TERMINAL_HUD_CONFIG.display,
    ...(config?.display && typeof config.display === 'object' ? config.display : {}),
    mergeGroups: Array.isArray(config?.display?.mergeGroups) ? config.display.mergeGroups : DEFAULT_TERMINAL_HUD_CONFIG.display.mergeGroups,
  },
})

let appSettingsCache
let contextWindowSettingsSynced = false

const readAppSettings = () => {
  if (typeof appSettingsCache !== 'undefined') return appSettingsCache
  try {
    appSettingsCache = APPDATA_SETTINGS_PATH ? JSON.parse(readFileSync(APPDATA_SETTINGS_PATH, 'utf8').replace(/^﻿/, '')) : null
  } catch {
    appSettingsCache = null
  }
  return appSettingsCache
}

const readTerminalHudConfig = () => {
  if (process.env.CLAUDE_HUD_ONE_TERMINAL_HUD === '0') return { ...DEFAULT_TERMINAL_HUD_CONFIG, enabled: false }
  try {
    const settings = readAppSettings()
    const config = mergeTerminalHudConfig(settings?.terminalHud)
    if (settings?.terminalHud?.preset === 'hud-plus-default') return mergeTerminalHudConfig(DEFAULT_TERMINAL_HUD_CONFIG)
    return config
  } catch {
    return DEFAULT_TERMINAL_HUD_CONFIG
  }
}

const appContextWindowOverrideState = () => {
  const display = readAppSettings()?.terminalHud?.display
  const managed = display?.contextWindowSizeOverrideManaged === true
  if (!managed) return { managed: false, value: null }
  const value = positiveNumberOrNull(display?.contextWindowSizeOverride)
  return { managed: true, value: value === null ? null : Math.round(value) }
}

const syncContextWindowOverrideToClaudeSettings = () => {
  if (contextWindowSettingsSynced) return
  contextWindowSettingsSynced = true
  const state = appContextWindowOverrideState()
  if (!state.managed || !CLAUDE_SETTINGS_PATH) return
  try {
    const settings = existsSync(CLAUDE_SETTINGS_PATH)
      ? JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf8').replace(/^﻿/, ''))
      : { $schema: 'https://json.schemastore.org/claude-code-settings.json' }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return
    const before = JSON.stringify(settings)
    if (state.value === null) {
      if (settings.env && typeof settings.env === 'object' && !Array.isArray(settings.env)) {
        delete settings.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE
        if (Object.keys(settings.env).length === 0) delete settings.env
      }
    } else {
      if (!settings.env || typeof settings.env !== 'object' || Array.isArray(settings.env)) settings.env = {}
      settings.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE = String(state.value)
    }
    if (settings.statusLine?.env && typeof settings.statusLine.env === 'object' && !Array.isArray(settings.statusLine.env)) {
      delete settings.statusLine.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE
      if (Object.keys(settings.statusLine.env).length === 0) delete settings.statusLine.env
    }
    if (JSON.stringify(settings) !== before) {
      mkdirSync(dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
      writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8')
    }
  } catch {
    // StatusLine rendering must never fail because config sync failed.
  }
}

const colorEnabled = () => process.env.NO_COLOR !== '1' && process.env.CLAUDE_HUD_ONE_NO_COLOR !== '1'
const color = (code, text) => colorEnabled() ? `[${code}m${text}[0m` : text
const NAMED_COLOR_CODES = {
  dim: '2',
  red: '31',
  green: '32',
  yellow: '33',
  magenta: '35',
  cyan: '36',
  brightBlue: '94',
  brightMagenta: '95',
}
const colorCode = (value, fallbackCode) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255) return `38;5;${value}`
  const text = typeof value === 'string' ? value.trim() : ''
  if (NAMED_COLOR_CODES[text]) return NAMED_COLOR_CODES[text]
  const match = /^#?([0-9a-fA-F]{6})$/.exec(text)
  if (!match) return fallbackCode
  const hex = match[1]
  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)
  return `38;2;${red};${green};${blue}`
}
const themed = (config, key, fallbackCode, text) => color(colorCode(config?.colors?.[key], fallbackCode), text)
const dim = (config, text) => themed(config, 'label', '2', text)

const stripAnsi = (text) => String(text).replace(/\[[0-9;]*m/g, '')
const cellWidth = (text) => {
  let width = 0
  const plain = stripAnsi(text)
  for (const char of plain) {
    const code = char.codePointAt(0) ?? 0
    width += code >= 0x1100 && (
      code <= 0x115f ||
      code === 0x2329 || code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff)
    ) ? 2 : 1
  }
  return width
}

const takeAnsi = (text, index) => {
  if (text.charCodeAt(index) !== 0x1b) return null
  const match = /^\[[0-9;]*m/.exec(text.slice(index))
  return match?.[0] ?? null
}

const truncateToWidth = (text, maxWidth) => {
  if (!maxWidth || cellWidth(text) <= maxWidth) return text
  const suffix = '…'
  let out = ''
  let width = 0
  for (let index = 0; index < text.length;) {
    const ansi = takeAnsi(text, index)
    if (ansi) {
      out += ansi
      index += ansi.length
      continue
    }
    const char = Array.from(text.slice(index))[0]
    const charWidth = cellWidth(char)
    if (width + charWidth + 1 > maxWidth) break
    out += char
    width += charWidth
    index += char.length
  }
  return `${out}${suffix}${colorEnabled() ? '[0m' : ''}`
}

const wrapLineToWidth = (text, maxWidth) => {
  if (!maxWidth || cellWidth(text) <= maxWidth) return [text]
  const words = text.split(/(\s+)/)
  const lines = []
  let current = ''
  for (const word of words) {
    if (!word) continue
    const next = `${current}${word}`
    if (current && cellWidth(next) > maxWidth) {
      lines.push(current.trimEnd())
      current = word.trimStart()
    } else {
      current = next
    }
  }
  if (current.trim().length > 0) lines.push(current.trimEnd())
  return lines.length ? lines.flatMap((line) => cellWidth(line) > maxWidth ? [truncateToWidth(line, maxWidth)] : [line]) : [truncateToWidth(text, maxWidth)]
}

const terminalWidth = (config) => {
  const envWidth = positiveNumberOrNull(process.env.CLAUDE_HUD_ONE_TERMINAL_MAX_WIDTH)
    ?? positiveNumberOrNull(process.env.COLUMNS)
    ?? null
  return positiveNumberOrNull(config?.maxWidth) ?? envWidth ?? 100
}

const formatPercent = (value) => {
  const percent = compactPercent(value)
  return percent === null ? null : `${percent}%`
}

const formatUsd = (value) => {
  const number = positiveNumberOrNull(value)
  if (number === null) return null
  if (number < 10) return `$${number.toFixed(2)}`
  return `$${number.toFixed(1)}`
}

const formatDuration = (value) => {
  const ms = positiveNumberOrNull(value)
  if (ms === null) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const formatReset = (value) => {
  const timestamp = millisOrNull(value)
  if (timestamp === null) return null
  const diffMs = timestamp - Date.now()
  if (diffMs <= 0) return 'now'
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

const formatAgo = (value) => {
  const timestamp = millisOrNull(value)
  if (timestamp === null) return null
  const diffMs = Math.max(0, Date.now() - timestamp)
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const formatAbsoluteTime = (value) => {
  const timestamp = millisOrNull(value)
  if (timestamp === null) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatConfiguredTime = (value, mode) => {
  const relative = formatAgo(value)
  const absolute = formatAbsoluteTime(value)
  if (mode === 'absolute') return absolute
  if (mode === 'both') return [absolute, relative].filter(Boolean).join(' / ') || null
  return relative
}

const formatDateMinute = (value) => {
  const timestamp = millisOrNull(value)
  if (timestamp === null) return null
  const date = new Date(timestamp)
  const pad = (input) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const colorKeyForBand = (value, config, kind) => {
  const percent = compactPercent(value)
  if (percent === null) return kind === 'usage' ? 'usage' : 'context'
  const bands = Array.isArray(config?.colors?.[`${kind}Bands`]) ? config.colors[`${kind}Bands`] : []
  for (const band of bands) {
    if (band && typeof band.min === 'number' && percent >= band.min && band.color !== undefined) {
      return band.color
    }
  }
  if (kind === 'usage') {
    if (percent >= (positiveNumberOrNull(config?.display?.usageThreshold) ?? 0) && (positiveNumberOrNull(config?.display?.usageThreshold) ?? 0) > 0) return 'usageWarning'
    return 'usage'
  }
  if (percent >= (positiveNumberOrNull(config?.display?.contextCriticalThreshold) ?? 85)) return 'critical'
  if (percent >= (positiveNumberOrNull(config?.display?.contextWarningThreshold) ?? 70)) return 'warning'
  return 'context'
}

const renderBandColor = (config, bandKey, fallbackCode, text) => {
  if (typeof bandKey === 'string' && Object.prototype.hasOwnProperty.call(config?.colors ?? {}, bandKey)) {
    return themed(config, bandKey, fallbackCode, text)
  }
  return color(colorCode(bandKey, fallbackCode), text)
}

const contextUsedPercent = (state) => compactPercent(state.contextUsedPercent)
  ?? (positiveNumberOrNull(state.contextUsedTokens) !== null && positiveNumberOrNull(state.contextWindowSize) !== null
    ? compactPercent((state.contextUsedTokens / state.contextWindowSize) * 100)
    : null)

const formatModelName = (state, config) => {
  const override = stringOrNull(config?.display?.modelOverride)
  let model = override ?? stringOrNull(state.modelName) ?? stringOrNull(state.modelId)
  if (!model) return null
  const mode = config?.display?.modelFormat ?? 'full'
  if (mode === 'compact' || mode === 'short') {
    model = model.replace(/\s*\([^)]*context[^)]*\)\s*$/i, '').trim()
  }
  if (mode === 'short') {
    model = model.replace(/^claude\s+/i, '').trim()
  }
  return model
}

const providerLabel = () => {
  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') return 'Bedrock'
  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') return 'Vertex'
  return null
}

const renderModelPart = (state, config) => {
  if (!config.display.showModel) return null
  const model = formatModelName(state, config)
  if (!model) return null
  const parts = [model, providerLabel()]
  if (config.display.showEffortLevel && state.effortLevel) {
    parts.push(`${state.thinkingEnabled ? '✦ ' : ''}${state.effortLevel}`)
  }
  return themed(config, 'model', '36', `[${parts.filter(Boolean).join(' | ')}]`)
}

const renderBar = (percent, config, width = 10, kind = 'context') => {
  const value = compactPercent(percent)
  if (value === null) return null
  const filled = Math.round((value / 100) * width)
  const filledChar = stringOrNull(config?.colors?.barFilled) ?? '█'
  const emptyChar = stringOrNull(config?.colors?.barEmpty) ?? '░'
  const text = `${filledChar.repeat(filled)}${emptyChar.repeat(Math.max(0, width - filled))}`
  return renderBandColor(config, colorKeyForBand(value, config, kind), kind === 'usage' ? '94' : '32', text)
}

const renderContextValue = (state, config) => {
  const mode = config.display.contextValue
  const usedTokens = nonNegativeIntegerOrNull(state.contextUsedTokens)
  const windowTokens = positiveNumberOrNull(state.contextWindowSize)
  const usedPercent = contextUsedPercent(state)
  const remainingPercent = compactPercent(state.contextRemainingPercent)
    ?? (usedPercent === null ? null : Math.max(0, 100 - usedPercent))
  const remainingTokens = usedTokens !== null && windowTokens !== null ? Math.max(0, windowTokens - usedTokens) : null
  const tokenLabel = usedTokens !== null
    ? (windowTokens !== null ? `${formatTokenK(usedTokens, true)}/${formatTokenK(windowTokens, true)}` : formatTokenK(usedTokens, true))
    : null
  const percentLabel = usedPercent === null ? null : `${usedPercent}%`
  const remainingLabel = remainingTokens !== null ? `${formatTokenK(remainingTokens)} left` : (remainingPercent === null ? null : `${remainingPercent}% left`)
  let text = null
  if (mode === 'tokens') text = tokenLabel
  else if (mode === 'percent') text = percentLabel
  else if (mode === 'remaining') text = remainingLabel
  else text = [percentLabel, tokenLabel ? `(${tokenLabel})` : null].filter(Boolean).join(' ') || null
  return text ? renderBandColor(config, colorKeyForBand(usedPercent, config, 'context'), '36', text) : null
}

const renderSessionTokens = (state, config) => {
  if (!config.display.showSessionTokens) return null
  const input = nonNegativeIntegerOrNull(state.inputTokens) ?? 0
  const output = nonNegativeIntegerOrNull(state.outputTokens) ?? 0
  const cache = (nonNegativeIntegerOrNull(state.cacheCreationInputTokens) ?? 0) + (nonNegativeIntegerOrNull(state.cacheReadInputTokens) ?? 0)
  const total = input + output + cache
  if (!total) return null
  const value = (text) => themed(config, 'labelValue', '37', text)
  const title = (text) => themed(config, 'labelTitle', '2', text)
  const parts = config.display.showTokenBreakdown ? [
    input ? `${title('in:')} ${value(formatTokenK(input))}` : null,
    output ? `${title('out:')} ${value(formatTokenK(output))}` : null,
    cache ? `${title('cache:')} ${value(formatTokenK(cache))}` : null,
  ].filter(Boolean) : []
  return `${title('Tokens')} ${value(formatTokenK(total))}${parts.length ? ` (${parts.join(', ')})` : ''}`
}

const renderUsage = (state, config) => {
  if (!config.display.showUsage) return null
  const usagePart = (label, usedPercent, resetAt, threshold) => {
    const used = compactPercent(usedPercent)
    if (used === null) return null
    const remaining = Math.max(0, 100 - used)
    const value = config.display.usageValue === 'remaining' ? `${remaining}% left` : `${used}%`
    const barText = config.display.usageBarEnabled && !config.display.usageCompact ? `${renderBar(used, config, 8, 'usage')} ` : ''
    const reset = config.display.showResetLabel && resetAt ? ` reset ${formatReset(resetAt)}` : ''
    const text = `${label} ${barText}${value}${reset}`
    const warnThreshold = positiveNumberOrNull(threshold) ?? 0
    const key = warnThreshold > 0 && used >= warnThreshold ? 'usageWarning' : colorKeyForBand(used, config, 'usage')
    return renderBandColor(config, key, '94', text)
  }
  const parts = [
    usagePart('5h', state.fiveHourUsedPercent, state.fiveHourResetAt, config.display.usageThreshold),
    usagePart('7d', state.sevenDayUsedPercent, state.sevenDayResetAt, config.display.sevenDayThreshold),
  ].filter(Boolean)
  return parts.length ? parts.join(config.display.usageCompact ? ' ' : ' · ') : null
}

const renderAddedDirs = (state, config) => {
  if (!config.display.showAddedDirs || !Array.isArray(state.addedDirSlugs) || state.addedDirSlugs.length === 0) return null
  const overflow = nonNegativeIntegerOrNull(state.addedDirsOverflowCount) ?? 0
  return `${dim(config, 'dirs')} ${state.addedDirSlugs.join(', ')}${overflow ? ` +${overflow}` : ''}`
}

const renderGit = (state, config) => {
  if (config.gitStatus?.enabled === false || !state.gitBranch) return null
  const branch = config.gitStatus?.branchOverflow === 'wrap'
    ? state.gitBranch
    : truncateToWidth(state.gitBranch, 32)
  const parts = [
    themed(config, 'gitBranch', '36', `${branch}${config.gitStatus?.showDirty !== false && state.gitDirty ? '*' : ''}`),
    config.gitStatus?.showAheadBehind ? (nonNegativeIntegerOrNull(state.gitAhead) ? `↑${state.gitAhead}` : null) : null,
    config.gitStatus?.showAheadBehind ? (nonNegativeIntegerOrNull(state.gitBehind) ? `↓${state.gitBehind}` : null) : null,
    config.gitStatus?.showFileStats && nonNegativeIntegerOrNull(state.totalLinesAdded) ? color('32', `+${state.totalLinesAdded}`) : null,
    config.gitStatus?.showFileStats && nonNegativeIntegerOrNull(state.totalLinesRemoved) ? color('31', `-${state.totalLinesRemoved}`) : null,
  ].filter(Boolean)
  return `${themed(config, 'git', '35', 'git:')}(${parts.join(' ')})`
}

const renderPromptCache = (state, config) => {
  if (!config.display.showPromptCache || !state.lastAssistantResponseAt) return null
  const timestamp = millisOrNull(state.lastAssistantResponseAt)
  if (timestamp === null) return null
  const ttlMs = (positiveNumberOrNull(config.display.promptCacheTtlSeconds) ?? 300) * 1000
  const remainingMs = ttlMs - (Date.now() - timestamp)
  if (remainingMs <= 0) return themed(config, 'warning', '33', 'cache expired')
  return `${dim(config, 'cache')} ${formatDuration(remainingMs)} left`
}

const formatBytesGb = (value) => {
  const bytes = positiveNumberOrNull(value)
  return bytes === null ? null : `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`
}

const renderMemory = (state, config) => {
  if (!config.display.showMemoryUsage) return null
  const usedPercent = compactPercent(state.memoryUsedPercent)
  if (usedPercent === null) return null
  const used = formatBytesGb(state.memoryUsedBytes)
  const total = formatBytesGb(state.memoryTotalBytes)
  return `${dim(config, 'RAM')} ${renderBar(usedPercent, config, 8) ?? `${usedPercent}%`} ${used && total ? `${used}/${total}` : `${usedPercent}%`}`
}

const renderEnvironment = (state, config) => {
  if (!config.display.showEnvironment) return null
  const parts = [
    nonNegativeIntegerOrNull(state.claudeMdCount) ? `${state.claudeMdCount} CLAUDE.md` : null,
    nonNegativeIntegerOrNull(state.rulesCount) ? `${state.rulesCount} rules` : null,
    nonNegativeIntegerOrNull(state.mcpCount) ? `${state.mcpCount} MCP` : null,
    nonNegativeIntegerOrNull(state.hooksCount) ? `${state.hooksCount} settings` : null,
  ].filter(Boolean)
  return parts.length ? `${dim(config, 'env')} ${parts.join(' · ')}` : null
}

const renderAgents = (state, config, summary = false, respectDisplay = true) => {
  if (respectDisplay && !config.display.showAgents) return null
  const total = nonNegativeIntegerOrNull(state.agentsCount) ?? 0
  const running = nonNegativeIntegerOrNull(state.agentsRunningCount) ?? 0
  if (!total && !running) return null
  const count = total || running
  return `${running ? '◐' : '✓'} ${themed(config, 'labelTitle', '2', 'Agents')} ${count}${running ? ` (${running} running)` : ''}`
}

const shortToolName = (toolName, activityLine) => {
  if (activityLine.toolNameFormat === 'full') return toolName
  const match = /^mcp__([^_]+(?:-[^_]+)*)__([\w-]+)$/i.exec(toolName)
  if (match) return `${match[1].replace(/^plugin[-_]?/i, '')}.${match[2]}`
  return toolName.replace(/^mcp__/i, '')
}

const renderTools = (state, config, summary = false, respectDisplay = true) => {
  if (respectDisplay && !config.display.showTools) return null
  const activityLine = config.activityLine ?? DEFAULT_TERMINAL_HUD_CONFIG.activityLine
  const tool = isRegularToolName(state.toolName) ? stringOrNull(state.toolName) : null
  const total = nonNegativeIntegerOrNull(state.toolsCount) ?? 0
  const explicitRunning = nonNegativeIntegerOrNull(state.toolsRunningCount) ?? 0
  const errors = nonNegativeIntegerOrNull(state.toolsErrorCount) ?? 0
  const runningTools = Array.isArray(state.toolsRunning)
    ? state.toolsRunning.filter((item) => isRegularToolName(item?.name))
    : []
  const counts = state.toolCountsByName && typeof state.toolCountsByName === 'object' ? state.toolCountsByName : null
  const runningNames = [...(tool ? [tool] : []), ...runningTools.map((item) => item.name)]
    .filter((name, index, names) => stringOrNull(name) && names.indexOf(name) === index)
    .slice(-2)
  const running = Math.max(explicitRunning, runningNames.length)
  if (!total && !running && !counts && !errors) return null
  if (!summary) {
    const parts = runningNames.map((name) => `◐ ${shortToolName(name, activityLine)}`)
    if (counts) {
      parts.push(...Object.entries(counts)
        .filter(([name, count]) => isRegularToolName(name) && nonNegativeIntegerOrNull(count))
        .sort((left, right) => (nonNegativeIntegerOrNull(right[1]) ?? 0) - (nonNegativeIntegerOrNull(left[1]) ?? 0))
        .slice(0, 4)
        .map(([name, count]) => `✓ ${shortToolName(name, activityLine)} ×${nonNegativeIntegerOrNull(count)}`))
    }
    if (parts.length) return parts.join(' ')
  }
  const count = total || running || 1
  const icon = running ? '◐' : errors ? '⚠' : '✓'
  return `${icon} ${themed(config, 'labelTitle', '2', 'Tools')} ${count}${running ? ` (${running} running)` : ''}`
}

const renderTodos = (state, config, summary = false, respectDisplay = true) => {
  if (respectDisplay && !config.display.showTodos) return null
  const total = nonNegativeIntegerOrNull(state.todosTotalCount) ?? 0
  const active = nonNegativeIntegerOrNull(state.todosActiveCount) ?? 0
  const completed = nonNegativeIntegerOrNull(state.todosCompletedCount) ?? 0
  if (!total && !active && !completed) return null
  const effectiveTotal = total || active + completed
  const progress = effectiveTotal ? `(${completed}/${effectiveTotal})` : ''
  if (summary) {
    if (active) return `▸ ${themed(config, 'labelTitle', '2', 'Todo')} ${progress}`.trim()
    if (effectiveTotal && completed >= effectiveTotal) return `✓ ${themed(config, 'labelTitle', '2', 'Todos')} ${progress}`.trim()
    return `Todo ${progress}`.trim()
  }
  if (active) return `▸ ${themed(config, 'labelTitle', '2', 'Todo')} ${progress}`.trim()
  if (effectiveTotal && completed >= effectiveTotal) return `✓ All todos complete ${progress}`.trim()
  return null
}

const renderSessionTime = (state, config) => {
  const mode = config.display.timeFormat ?? 'relative'
  const lastResponse = formatConfiguredTime(state.lastAssistantResponseAt, mode)
  const value = (text) => themed(config, 'labelValue', '37', text)
  const title = (text) => themed(config, 'labelTitle', '2', text)
  const parts = [
    config.display.showSessionStartDate && state.sessionStartedAt ? `${title('Started:')} ${value(formatDateMinute(state.sessionStartedAt))}` : null,
    config.display.showLastResponseAt && lastResponse ? `${title('Last reply:')} ${value(lastResponse)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' │ ') : null
}

const renderSpeed = (state, config) => {
  const speed = positiveNumberOrNull(state.outputSpeed)
  if (!config.display.showSpeed || speed === null) return null
  return `${speed >= 10 ? Math.round(speed) : speed.toFixed(1)} tok/s`
}

const meaningfulStatusText = (state) => {
  const text = stringOrNull(state.statusText)
  if (!text) return null
  if (/^(active|claude code active|claude hud one)$/i.test(text)) return null
  if (/context$/i.test(text) && (state.modelName ? text.includes(state.modelName) : true)) return null
  return text
}

const renderActivity = (state, config) => {
  const activityLine = config.activityLine ?? DEFAULT_TERMINAL_HUD_CONFIG.activityLine
  const items = activityLine.items ?? DEFAULT_TERMINAL_HUD_CONFIG.activityLine.items
  const warnings = activityLine.warnings ?? DEFAULT_TERMINAL_HUD_CONFIG.activityLine.warnings
  const warningParts = []
  if (warnings.usage && compactPercent(state.fiveHourUsedPercent) !== null && compactPercent(state.fiveHourUsedPercent) >= (positiveNumberOrNull(config.display.usageThreshold) ?? 100)) warningParts.push(themed(config, 'usageWarning', '95', `⚠ Usage ${formatPercent(state.fiveHourUsedPercent)}`))
  if (warnings.memory && compactPercent(state.memoryUsedPercent) !== null && compactPercent(state.memoryUsedPercent) >= 90) warningParts.push(themed(config, 'warning', '33', `⚠ RAM ${formatPercent(state.memoryUsedPercent)}`))
  if (warnings.environment && positiveNumberOrNull(config.display.environmentThreshold) && nonNegativeIntegerOrNull(state.mcpCount) >= config.display.environmentThreshold) warningParts.push(themed(config, 'warning', '33', `⚠ Env ${state.mcpCount}`))
  if (warnings.promptCache) {
    const cache = renderPromptCache(state, { ...config, display: { ...config.display, showPromptCache: true } })
    if (cache) warningParts.push(cache)
  }
  const detailParts = [
    ...warningParts,
    items.todos !== false ? renderTodos(state, config, false, false) : null,
    items.agents !== false ? renderAgents(state, config, false, false) : null,
    items.tools !== false ? renderTools(state, config, false, false) : null,
    items.sessionTime === true ? renderSessionTime(state, config) : null,
  ].filter(Boolean)
  const summaryParts = [
    ...warningParts,
    items.todos !== false ? renderTodos(state, config, true, false) : null,
    items.agents !== false ? renderAgents(state, config, true, false) : null,
    items.tools !== false ? renderTools(state, config, true, false) : null,
    items.sessionTime === true ? renderSessionTime(state, config) : null,
  ].filter(Boolean)
  const details = detailParts.join(' ')
  const summary = summaryParts.join(' | ')
  const status = meaningfulStatusText(state)
  if (activityLine.mode === 'summary') return summary || status
  if (activityLine.mode === 'details') return details || status
  const maxWidth = terminalWidth(config)
  const allowed = Math.max(20, Math.floor(maxWidth * (positiveNumberOrNull(activityLine.maxWidthRatio) ?? 0.9)))
  if (details && cellWidth(details) <= allowed) return details
  return summary || details || status
}

const renderTerminalRowItem = (state, item, config) => {
  switch (item) {
    case 'model':
      return renderModelPart(state, config)
    case 'contextBar':
      return config.display.showContextBar ? renderBar(contextUsedPercent(state), config, 10, 'context') : null
    case 'contextValue':
      return renderContextValue(state, config)
    case 'project':
      return config.display.showProject ? themed(config, 'project', '33', state.projectSlug ?? baseName(state.projectDir ?? state.cwd) ?? 'Claude Code') : null
    case 'addedDirs':
      return renderAddedDirs(state, config)
    case 'git':
      return renderGit(state, config)
    case 'tools':
      return renderTools(state, config)
    case 'agents':
      return renderAgents(state, config)
    case 'todos':
      return renderTodos(state, config)
    case 'activity':
      return renderActivity(state, config)
    case 'sessionTokens':
      return renderSessionTokens(state, config)
    case 'usage':
      return renderUsage(state, config)
    case 'promptCache':
      return renderPromptCache(state, config)
    case 'memory':
      return renderMemory(state, config)
    case 'environment':
      return renderEnvironment(state, config)
    case 'cost':
      return config.display.showCost ? formatUsd(state.totalCostUsd) : null
    case 'duration':
      return config.display.showDuration ? formatDuration(state.totalDurationMs) : null
    case 'speed':
      return renderSpeed(state, config)
    case 'sessionTime':
      return renderSessionTime(state, config)
    case 'outputStyle':
      return config.display.showOutputStyle && state.outputStyle ? `style ${state.outputStyle}` : null
    case 'claudeCodeVersion':
      return config.display.showClaudeCodeVersion && state.version ? `Claude Code ${state.version}` : null
    case 'effortLevel':
      return config.display.showEffortLevel && state.effortLevel ? `effort ${state.effortLevel}${state.thinkingEnabled ? ' · thinking' : ''}` : null
    case 'customLine':
      return stringOrNull(config.display.customLine) ? themed(config, 'custom', '38;5;208', config.display.customLine) : null
    default:
      return null
  }
}

const renderTerminalHud = (state) => {
  const config = readTerminalHudConfig()
  if (!config.enabled) return null
  const maxWidth = terminalWidth(config)
  const separator = config.showSeparators ? ' │ ' : ' '
  const lines = config.rows
    .map((row) => row.map((item) => renderTerminalRowItem(state, item, config)).filter(Boolean).join(separator))
    .filter(Boolean)
  const text = lines.length ? lines.join('\n') : `Claude HUD One · ${state.statusText ?? 'Claude Code active'}`
  return text.split('\n').flatMap((line) => (
    config.rowOverflow === 'wrap' ? wrapLineToWidth(line, maxWidth) : [truncateToWidth(line, maxWidth)]
  )).join('\n')
}

const safeRenderTerminalHud = (state) => {
  if (MODE !== 'statusLine') return null
  try {
    return renderTerminalHud(state)
  } catch {
    return null
  }
}

const sanitizeToolName = (input) => stringOrNull(input?.tool_name ?? input?.toolName ?? input?.tool?.name)
const sanitizeHookEvent = (input) => stringOrNull(input?.hook_event_name ?? input?.hookEventName ?? input?.event)

const activityFromHook = (hookEvent) => {
  switch (hookEvent) {
    case 'UserPromptSubmit':
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PreCompact':
      return 'running'
    case 'Notification':
    case 'Stop':
      return 'waiting'
    case 'StopFailure':
      return 'error'
    case 'SessionEnd':
      return 'idle'
    default:
      return 'active'
  }
}

const statusTextFromHook = (hookEvent, toolName) => {
  switch (hookEvent) {
    case 'UserPromptSubmit': return 'Generating response'
    case 'PreToolUse': return toolName ? `Tool running: ${toolName}` : 'Tool running'
    case 'PostToolUse': return toolName ? `Tool finished: ${toolName}` : 'Tool finished'
    case 'Notification': return 'Needs attention'
    case 'Stop': return 'Waiting for user'
    case 'StopFailure': return 'Run failed'
    case 'SessionStart': return 'Session started'
    case 'SessionEnd': return 'Session ended'
    case 'PreCompact': return 'Compacting context'
    case 'CwdChanged': return 'Working directory changed'
    default: return hookEvent ?? 'Hook event'
  }
}

const firstNumber = (...values) => {
  for (const value of values) {
    const number = numberOrNull(value)
    if (number !== null) return number
  }
  return null
}

const contextWindowOverrideSize = () => {
  const appOverride = appContextWindowOverrideState()
  if (appOverride.managed) {
    syncContextWindowOverrideToClaudeSettings()
    return appOverride.value
  }
  const value = positiveNumberOrNull(process.env.CLAUDE_HUD_CONTEXT_WINDOW_SIZE)
  return value === null ? null : Math.round(value)
}

const safeUsageCount = (value) => {
  const number = numberOrNull(value)
  return number !== null && number > 0 ? Math.trunc(number) : 0
}

const emptySessionTokenUsage = () => ({
  inputTokens: null,
  outputTokens: null,
  cacheCreationInputTokens: null,
  cacheReadInputTokens: null,
})

const sessionTokenTotal = (tokens) => [
  tokens?.inputTokens,
  tokens?.outputTokens,
  tokens?.cacheCreationInputTokens,
  tokens?.cacheReadInputTokens,
].map(safeUsageCount).reduce((sum, value) => sum + value, 0)

const extractExplicitSessionTokens = (input) => {
  const transcriptTokens = input?.transcript?.sessionTokens ?? input?.transcript?.session_tokens ?? input?.sessionTokens ?? input?.session_tokens ?? input?.usage?.sessionTokens ?? input?.usage?.session_tokens ?? {}
  return {
    inputTokens: firstNumber(transcriptTokens?.inputTokens, transcriptTokens?.input_tokens, input?.tokens?.input, input?.tokens?.input_tokens),
    outputTokens: firstNumber(transcriptTokens?.outputTokens, transcriptTokens?.output_tokens, input?.tokens?.output, input?.tokens?.output_tokens),
    cacheCreationInputTokens: firstNumber(transcriptTokens?.cacheCreationTokens, transcriptTokens?.cacheCreationInputTokens, transcriptTokens?.cache_creation_tokens, transcriptTokens?.cache_creation_input_tokens, input?.tokens?.cacheCreationInputTokens, input?.tokens?.cache_creation_input_tokens),
    cacheReadInputTokens: firstNumber(transcriptTokens?.cacheReadTokens, transcriptTokens?.cacheReadInputTokens, transcriptTokens?.cache_read_tokens, transcriptTokens?.cache_read_input_tokens, input?.tokens?.cacheReadInputTokens, input?.tokens?.cache_read_input_tokens),
  }
}

const ACTIVITY_NON_TOOL_NAMES = new Set(['Task', 'Agent', 'TodoWrite', 'TodoRead', 'TaskCreate', 'TaskUpdate'])
const AGENT_TOOL_NAMES = new Set(['Task', 'Agent'])
const TODO_TOOL_NAMES = new Set(['TodoWrite', 'TodoRead', 'TaskCreate', 'TaskUpdate'])
const isRegularToolName = (name) => Boolean(stringOrNull(name)) && !ACTIVITY_NON_TOOL_NAMES.has(name)

const safeContentArray = (entry) => {
  const content = entry?.message?.content ?? entry?.content
  return Array.isArray(content) ? content : []
}

const todoStatusCounts = (statuses) => {
  const normalized = statuses.map(stringOrNull).filter(Boolean)
  if (normalized.length === 0) return null
  return {
    total: normalized.length,
    active: normalized.filter((status) => status === 'in_progress' || status === 'active').length,
    completed: normalized.filter((status) => status === 'completed' || status === 'done').length,
  }
}

const readTranscriptSummary = (transcriptPath) => {
  if (!transcriptPath || !existsSync(transcriptPath)) return { sessionTokens: emptySessionTokenUsage() }
  try {
    const tokens = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 }
    let sawUsage = false
    const toolById = new Map()
    const toolCountsByName = {}
    let toolsCount = 0
    let toolsErrorCount = 0
    let agentsCount = 0
    let todoOperationCount = 0
    let firstTimestamp = null
    let lastAssistantResponseAt = null
    let latestTodoListCounts = null
    const taskStatusById = new Map()
    const lines = readFileSync(transcriptPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const cleanLine = line.replace(/^﻿/, '')
      if (!cleanLine.trim()) continue
      let entry = null
      try {
        entry = JSON.parse(cleanLine)
      } catch {
        continue
      }
      const timestamp = safeIsoString(entry?.timestamp ?? entry?.message?.timestamp ?? entry?.created_at ?? entry?.createdAt)
      if (timestamp) {
        if (!firstTimestamp) firstTimestamp = timestamp
        if (entry?.type === 'assistant') lastAssistantResponseAt = timestamp
      }
      const usage = entry?.type === 'assistant' ? entry?.message?.usage : null
      if (usage && typeof usage === 'object') {
        sawUsage = true
        tokens.inputTokens += safeUsageCount(usage.input_tokens)
        tokens.outputTokens += safeUsageCount(usage.output_tokens)
        tokens.cacheCreationInputTokens += safeUsageCount(usage.cache_creation_input_tokens)
        tokens.cacheReadInputTokens += safeUsageCount(usage.cache_read_input_tokens)
      }
      for (const item of safeContentArray(entry)) {
        if (item?.type === 'tool_use' && stringOrNull(item?.name)) {
          const name = stringOrNull(item.name)
          const id = stringOrNull(item.id)
          const isAgent = AGENT_TOOL_NAMES.has(name)
          const isTodo = TODO_TOOL_NAMES.has(name)
          if (isAgent) {
            agentsCount += 1
            if (id) toolById.set(id, { name, kind: 'agent' })
            continue
          }
          if (isTodo) {
            todoOperationCount += 1
            const toolInput = item?.input && typeof item.input === 'object' ? item.input : null
            const todoItems = Array.isArray(toolInput?.todos) ? toolInput.todos : Array.isArray(toolInput?.items) ? toolInput.items : null
            const todoCounts = todoItems ? todoStatusCounts(todoItems.map((todo) => todo?.status)) : null
            if (todoCounts) latestTodoListCounts = todoCounts
            const taskId = stringOrNull(toolInput?.taskId ?? toolInput?.task_id ?? toolInput?.id)
            const status = stringOrNull(toolInput?.status)
            if (taskId && status) taskStatusById.set(taskId, status)
            if (id) toolById.set(id, { name, kind: 'todo' })
            continue
          }
          if (isRegularToolName(name)) {
            toolsCount += 1
            if (id) toolById.set(id, { name, kind: 'tool' })
          }
        }
        if (item?.type === 'tool_result' && stringOrNull(item?.tool_use_id)) {
          const tool = toolById.get(item.tool_use_id)
          if (!tool) continue
          if (tool.kind === 'tool') {
            toolCountsByName[tool.name] = (toolCountsByName[tool.name] ?? 0) + 1
            if (item.is_error === true) toolsErrorCount += 1
          }
          toolById.delete(item.tool_use_id)
        }
      }
    }
    const runningTools = Array.from(toolById.values()).filter((tool) => tool.kind === 'tool').slice(-2)
    const runningAgents = Array.from(toolById.values()).filter((tool) => tool.kind === 'agent')
    const taskTodoCounts = todoStatusCounts(Array.from(taskStatusById.values()))
    const todoCounts = latestTodoListCounts ?? taskTodoCounts
    return {
      sessionTokens: sawUsage ? tokens : emptySessionTokenUsage(),
      toolsCount: toolsCount || null,
      toolsRunningCount: runningTools.length || null,
      toolsErrorCount: toolsErrorCount || null,
      toolCountsByName: Object.keys(toolCountsByName).length ? toolCountsByName : null,
      toolsRunning: runningTools.length ? runningTools : null,
      agentsCount: agentsCount || null,
      agentsRunningCount: runningAgents.length || null,
      todoOperationCount: todoOperationCount || null,
      todosActiveCount: todoCounts?.active ?? null,
      todosCompletedCount: todoCounts?.completed ?? null,
      todosTotalCount: todoCounts?.total ?? null,
      firstTimestamp,
      lastAssistantResponseAt,
    }
  } catch {
    return { sessionTokens: emptySessionTokenUsage() }
  }
}

const extractPermissionMode = (input) => stringOrNull(
  input?.permission_mode
  ?? input?.permissionMode
  ?? input?.permissions?.mode
  ?? input?.permission?.mode
  ?? input?.session?.permission_mode
  ?? input?.session?.permissionMode
)

const summarizeStatusLine = (input) => {
  const context = input?.context_window ?? {}
  const currentUsage = context?.current_usage ?? {}
  const cost = input?.cost ?? {}
  const model = input?.model ?? {}
  const workspace = input?.workspace ?? {}
  const rateLimits = input?.rate_limits ?? {}
  const contextWindowSize = contextWindowOverrideSize() ?? positiveNumberOrNull(context?.context_window_size)
  const contextUsageTokens = sumNonNegative(
    currentUsage?.input_tokens,
    currentUsage?.cache_creation_input_tokens,
    currentUsage?.cache_read_input_tokens,
  ) ?? numberOrNull(context?.total_input_tokens)
  const usedPercentage = contextWindowOverrideSize() !== null && contextUsageTokens !== null && contextWindowSize !== null
    ? compactPercent((contextUsageTokens / contextWindowSize) * 100)
    : compactPercent(context?.used_percentage) ?? (contextUsageTokens !== null && contextWindowSize !== null ? compactPercent((contextUsageTokens / contextWindowSize) * 100) : null)
  const percentUsageTokens = usedPercentage !== null && contextWindowSize !== null
    ? (contextWindowSize * usedPercentage) / 100
    : null
  const contextUsedTokens = contextUsageTokens ?? percentUsageTokens
  const transcriptPath = stringOrNull(input?.transcript_path)
  const transcriptSummary = readTranscriptSummary(transcriptPath)
  const explicitSessionTokens = extractExplicitSessionTokens(input)
  const sessionTokens = sessionTokenTotal(transcriptSummary.sessionTokens) > 0 ? transcriptSummary.sessionTokens : explicitSessionTokens
  const modelName = stringOrNull(model?.display_name) ?? stringOrNull(model?.id)
  const projectDir = stringOrNull(workspace?.project_dir) ?? stringOrNull(input?.cwd)
  const projectSlug = baseName(projectDir) ?? stringOrNull(input?.session_name) ?? 'Claude Code'
  const addedDirs = sanitizeAddedDirs(workspace)
  const gitSummary = readGitSummary(projectDir)
  const memorySummary = readMemorySummary()
  const environmentSummary = readEnvironmentSummary(projectDir)
  const totalDurationMs = numberOrNull(cost?.total_duration_ms)
  const outputTokens = numberOrNull(sessionTokens.outputTokens)
  const outputSpeed = positiveNumberOrNull(input?.speed?.output_tokens_per_second ?? input?.output_speed)
    ?? (outputTokens !== null && totalDurationMs !== null && totalDurationMs > 0 ? outputTokens / (totalDurationMs / 1000) : null)
  const activeToolName = isRegularToolName(input?.tool?.name ?? input?.toolName ?? input?.tool_name) ? stringOrNull(input?.tool?.name ?? input?.toolName ?? input?.tool_name) : null
  const toolsCount = firstCount(transcriptSummary.toolsCount, input?.tools?.total, input?.tools?.count, input?.tool_calls?.total, input?.toolCalls?.total, input?.toolCallRecordCount)
  const toolsRunningCount = firstCount(input?.tools?.running, input?.tool?.running, transcriptSummary.toolsRunningCount)
  const toolsErrorCount = firstCount(input?.tools?.errors, input?.tools?.error, transcriptSummary.toolsErrorCount)
  const agentsCount = firstCount(transcriptSummary.agentsCount, input?.agents?.total, input?.agent?.total, input?.agent?.count)
  const agentsRunningCount = firstCount(input?.agents?.running, input?.agent?.running, transcriptSummary.agentsRunningCount)
  const todosActiveCount = firstCount(input?.todos?.active, input?.todos?.in_progress, input?.todos?.pending, transcriptSummary.todosActiveCount)
  const todosCompletedCount = firstCount(input?.todos?.completed, transcriptSummary.todosCompletedCount)
  const todosTotalCount = firstCount(input?.todos?.total, transcriptSummary.todosTotalCount, transcriptSummary.todoOperationCount)
  const statusText = stringOrNull(input?.status_text ?? input?.statusText) ?? 'Claude Code active'
  const permissionMode = extractPermissionMode(input)

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    activityStartedAt: new Date().toISOString(),
    event: 'statusLine',
    activity: 'active',
    statusText,
    sessionId: stringOrNull(input?.session_id),
    sessionName: stringOrNull(input?.session_name),
    cwd: stringOrNull(input?.cwd),
    projectDir,
    projectSlug,
    transcriptPath,
    modelId: stringOrNull(model?.id),
    modelName,
    version: stringOrNull(input?.version),
    outputStyle: stringOrNull(input?.output_style?.name),
    contextUsedPercent: usedPercentage,
    contextRemainingPercent: compactPercent(context?.remaining_percentage),
    contextWindowSize,
    contextUsedTokens: numberOrNull(contextUsedTokens),
    permissionMode,
    inputTokens: numberOrNull(sessionTokens.inputTokens),
    outputTokens,
    cacheCreationInputTokens: numberOrNull(sessionTokens.cacheCreationInputTokens),
    cacheReadInputTokens: numberOrNull(sessionTokens.cacheReadInputTokens),
    totalCostUsd: numberOrNull(cost?.total_cost_usd),
    totalDurationMs,
    totalApiDurationMs: numberOrNull(cost?.total_api_duration_ms),
    totalLinesAdded: numberOrNull(cost?.total_lines_added),
    totalLinesRemoved: numberOrNull(cost?.total_lines_removed),
    outputSpeed: positiveNumberOrNull(outputSpeed),
    ...addedDirs,
    ...gitSummary,
    ...memorySummary,
    ...environmentSummary,
    sessionStartedAt: safeIsoString(input?.session_started_at ?? input?.session?.started_at ?? input?.started_at) ?? transcriptSummary.firstTimestamp,
    lastAssistantResponseAt: safeIsoString(input?.last_assistant_response_at ?? input?.last_response_at ?? input?.session?.last_assistant_response_at ?? input?.session?.lastResponseAt ?? input?.message?.timestamp) ?? transcriptSummary.lastAssistantResponseAt,
    toolsCount,
    toolsRunningCount,
    toolsErrorCount,
    toolCountsByName: transcriptSummary.toolCountsByName ?? null,
    toolsRunning: transcriptSummary.toolsRunning ?? null,
    agentsCount,
    agentsRunningCount,
    todosActiveCount,
    todosCompletedCount,
    todosTotalCount,
    fiveHourUsedPercent: compactPercent(rateLimits?.five_hour?.used_percentage),
    fiveHourResetAt: stringOrNull(rateLimits?.five_hour?.resets_at),
    sevenDayUsedPercent: compactPercent(rateLimits?.seven_day?.used_percentage),
    sevenDayResetAt: stringOrNull(rateLimits?.seven_day?.resets_at),
    effortLevel: stringOrNull(input?.effort?.level),
    thinkingEnabled: boolOrNull(input?.thinking?.enabled),
    agentName: stringOrNull(input?.agent?.name),
    hookEventName: null,
    toolName: activeToolName,
    source: 'statusLine',
    privacyNote: 'Claude HUD One bridge stores only sanitized status metrics. It does not store prompt, transcript, tool-result or credential content.',
  }
}

const summarizeHook = (input) => {
  const hookEvent = sanitizeHookEvent(input) ?? 'Hook'
  const rawToolName = sanitizeToolName(input)
  const toolName = isRegularToolName(rawToolName) ? rawToolName : null
  const cwd = stringOrNull(input?.cwd)
  const projectDir = stringOrNull(input?.workspace?.project_dir) ?? cwd
  const addedDirs = sanitizeAddedDirs(input?.workspace)
  const gitSummary = readGitSummary(projectDir)
  const memorySummary = readMemorySummary()
  const environmentSummary = readEnvironmentSummary(projectDir)
  const isAgentTool = AGENT_TOOL_NAMES.has(rawToolName)
  const isTodoTool = TODO_TOOL_NAMES.has(rawToolName)

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    activityStartedAt: new Date().toISOString(),
    event: 'hook',
    activity: activityFromHook(hookEvent),
    statusText: statusTextFromHook(hookEvent, rawToolName),
    sessionId: stringOrNull(input?.session_id),
    sessionName: stringOrNull(input?.session_name),
    cwd,
    projectDir,
    projectSlug: baseName(projectDir) ?? stringOrNull(input?.session_name) ?? 'Claude Code',
    transcriptPath: stringOrNull(input?.transcript_path),
    modelId: null,
    modelName: null,
    version: stringOrNull(input?.version),
    outputStyle: null,
    contextUsedPercent: null,
    contextRemainingPercent: null,
    contextWindowSize: null,
    contextUsedTokens: null,
    permissionMode: extractPermissionMode(input),
    inputTokens: null,
    outputTokens: null,
    cacheCreationInputTokens: null,
    cacheReadInputTokens: null,
    totalCostUsd: null,
    totalDurationMs: null,
    totalApiDurationMs: null,
    totalLinesAdded: null,
    totalLinesRemoved: null,
    outputSpeed: null,
    ...addedDirs,
    ...gitSummary,
    ...memorySummary,
    ...environmentSummary,
    sessionStartedAt: safeIsoString(input?.session_started_at ?? input?.session?.started_at ?? input?.started_at),
    lastAssistantResponseAt: null,
    toolsCount: toolName ? 1 : null,
    toolsRunningCount: hookEvent === 'PreToolUse' && toolName ? 1 : null,
    agentsCount: isAgentTool ? 1 : null,
    agentsRunningCount: isAgentTool ? 1 : null,
    todosActiveCount: isTodoTool ? 1 : null,
    todosCompletedCount: null,
    todosTotalCount: isTodoTool ? 1 : null,
    fiveHourUsedPercent: null,
    fiveHourResetAt: null,
    sevenDayUsedPercent: null,
    sevenDayResetAt: null,
    effortLevel: null,
    thinkingEnabled: null,
    agentName: null,
    hookEventName: hookEvent,
    toolName,
    source: 'hook',
    privacyNote: 'Claude HUD One hook bridge stores only event name, tool name and sanitized status metadata. It does not store user prompt, tool input, tool result, transcript or credential content.',
  }
}

const hookHoldMs = (state) => {
  if (!state || typeof state !== 'object') return 0
  if (state.activity === 'running') return RUNNING_HOOK_HOLD_MS
  if (state.activity === 'waiting' || state.activity === 'error') return TERMINAL_HOOK_HOLD_MS
  return 0
}

const shouldPreservePreviousActivity = (nextState, previousState) => {
  if (MODE !== 'statusLine') return false
  if (!previousState || typeof previousState !== 'object') return false
  if (!previousState.hookEventName && previousState.event !== 'hook') return false

  const holdMs = hookHoldMs(previousState)
  if (holdMs <= 0) return false

  const startedAt = millisOrNull(previousState.activityStartedAt) ?? millisOrNull(previousState.updatedAt)
  return startedAt !== null && Date.now() - startedAt < holdMs
}

const mergeWithPrevious = (nextState, previousState) => {
  if (!previousState || typeof previousState !== 'object') return nextState

  const keepFromPrevious = [
    'modelId', 'modelName', 'contextUsedPercent', 'contextRemainingPercent', 'contextWindowSize', 'contextUsedTokens', 'permissionMode',
    'inputTokens', 'outputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens',
    'totalCostUsd', 'totalDurationMs', 'totalApiDurationMs', 'totalLinesAdded', 'totalLinesRemoved', 'outputSpeed',
    'sessionStartedAt', 'lastAssistantResponseAt', 'toolsCount', 'toolsRunningCount', 'toolsErrorCount', 'toolCountsByName', 'toolsRunning', 'agentsCount', 'agentsRunningCount', 'todosActiveCount', 'todosCompletedCount', 'todosTotalCount',
    'fiveHourUsedPercent', 'fiveHourResetAt', 'sevenDayUsedPercent', 'sevenDayResetAt', 'effortLevel', 'thinkingEnabled', 'agentName',
  ]

  const merged = { ...nextState }
  for (const key of keepFromPrevious) {
    if (merged[key] === null || typeof merged[key] === 'undefined') merged[key] = previousState[key] ?? null
  }
  if (!merged.projectDir) merged.projectDir = previousState.projectDir ?? null
  if (!merged.projectSlug || merged.projectSlug === 'Claude Code') merged.projectSlug = previousState.projectSlug ?? merged.projectSlug

  if (shouldPreservePreviousActivity(nextState, previousState)) {
    merged.event = previousState.event ?? merged.event
    merged.activity = previousState.activity ?? merged.activity
    merged.statusText = previousState.statusText ?? merged.statusText
    merged.hookEventName = previousState.hookEventName ?? null
    merged.toolName = previousState.toolName ?? null
    merged.source = previousState.source ?? merged.source
    merged.activityStartedAt = previousState.activityStartedAt ?? previousState.updatedAt ?? merged.activityStartedAt
  }

  return merged
}

const sessionKeyFromState = (state) => (
  safeFileName(state?.sessionId)
  ?? safeFileName(state?.transcriptPath)
  ?? safeFileName([state?.projectSlug, state?.sessionName, state?.projectDir ?? state?.cwd].filter(Boolean).join('-'))
  ?? `pid-${process.pid}`
)

const sessionStatePaths = (sessionKey) => [
  APPDATA_SESSIONS_DIR ? resolve(APPDATA_SESSIONS_DIR, `${sessionKey}.json`) : null,
  resolve(PROJECT_SESSIONS_DIR, `${sessionKey}.json`),
].filter(Boolean)

const readJsonFile = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const readPreviousState = () => readJsonFile(APPDATA_STATE_PATH ?? PROJECT_STATE_PATH)

const readPreviousSessionState = (sessionKey) => {
  for (const path of sessionStatePaths(sessionKey)) {
    const state = readJsonFile(path)
    if (state) return state
  }
  return null
}

const writeStateFile = (targetPath, state) => {
  if (!targetPath) return
  try {
    mkdirSync(dirname(targetPath), { recursive: true })
    const tmpPath = `${targetPath}.${process.pid}.tmp`
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8')
    renameSync(tmpPath, targetPath)
  } catch {
    // Fail-safe: status bridge must never block or break Claude Code.
  }
}

try {
  const text = await readStdin()
  const cleanText = text.replace(/^﻿/, '')
  const input = cleanText.trim() ? JSON.parse(cleanText) : {}
  const rawNextState = MODE === 'hook' ? summarizeHook(input) : summarizeStatusLine(input)
  const sessionKey = sessionKeyFromState(rawNextState)
  const previousState = readPreviousSessionState(sessionKey) ?? readPreviousState()
  const nextState = { ...mergeWithPrevious(rawNextState, previousState), sessionKey }
  writeStateFile(APPDATA_STATE_PATH, nextState)
  writeStateFile(PROJECT_STATE_PATH, nextState)
  for (const path of sessionStatePaths(sessionKey)) writeStateFile(path, nextState)

  const fallbackStatusLineText = MODE === 'statusLine'
    ? `Claude HUD One · ${nextState.statusText}`
    : ''
  const builtInTerminalHudText = safeRenderTerminalHud(nextState)
  // Claude HUD One owns Terminal HUD rendering. The old Claude HUD Plus command may be
  // kept as an install-time diagnostic backup, but is not executed as a runtime renderer.
  complete(builtInTerminalHudText ?? fallbackStatusLineText)
} catch {
  complete(FALLBACK_STATUS)
}
