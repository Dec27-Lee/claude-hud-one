import type { TerminalHudConfig } from './config'
import type { HudDisplayItemId, NormalizedHudState } from './types'

const formatTokenCount = (tokens: number | null | undefined, allowZero = false): string | null => {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0) return null
  if (tokens === 0) return allowZero ? '0' : null
  if (tokens < 1_000) return `${Math.round(tokens)} tokens`
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}K`
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}K`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

const compactTokens = (tokens: number | null | undefined): string | null => formatTokenCount(tokens)

const clampPercent = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

const percent = (value: number | null | undefined): string | null => {
  const normalized = clampPercent(value)
  return normalized === null ? null : `${normalized}%`
}

const dollars = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value < 10 ? `$${value.toFixed(2)}` : `$${value.toFixed(1)}`
}

const duration = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const seconds = Math.round(value / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

const relativeTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const diffMs = Math.max(0, Date.now() - timestamp)
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const clockTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const absoluteDateMinute = (value: string | null | undefined): string | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  const pad = (input: number): string => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const configuredTime = (value: string | null | undefined, config: TerminalHudConfig): string | null => {
  if (config.display.timeFormat === 'absolute') return clockTime(value)
  if (config.display.timeFormat === 'both') return [clockTime(value), relativeTime(value)].filter(Boolean).join(' / ') || null
  return relativeTime(value)
}

const contextUsedPercent = (state: NormalizedHudState): number | null => {
  const direct = clampPercent(state.context.usedPercent)
  if (direct !== null) return direct
  if (typeof state.context.usedTokens === 'number' && Number.isFinite(state.context.usedTokens) && state.context.usedTokens >= 0 &&
    typeof state.context.windowSize === 'number' && Number.isFinite(state.context.windowSize) && state.context.windowSize > 0) {
    return clampPercent((state.context.usedTokens / state.context.windowSize) * 100)
  }
  return null
}

const bar = (value: number | null | undefined, config: TerminalHudConfig, width = 10): string | null => {
  const normalized = clampPercent(value)
  if (normalized === null) return null
  const filled = Math.round((normalized / 100) * width)
  const filledChar = config.colors.barFilled || '█'
  const emptyChar = config.colors.barEmpty || '░'
  return `${filledChar.repeat(filled)}${emptyChar.repeat(Math.max(0, width - filled))}`
}

const positiveCount = (value: number | null | undefined): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
)

const cellWidth = (text: string): number => Array.from(text).reduce((width, char) => {
  const code = char.codePointAt(0) ?? 0
  return width + (code >= 0x1100 && (
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
  ) ? 2 : 1)
}, 0)

const truncateToWidth = (text: string, maxWidth: number | null): string => {
  if (!maxWidth || cellWidth(text) <= maxWidth) return text
  const suffix = '…'
  let output = ''
  let width = 0
  for (const char of Array.from(text)) {
    const charWidth = cellWidth(char)
    if (width + charWidth + 1 > maxWidth) break
    output += char
    width += charWidth
  }
  return `${output}${suffix}`
}

const wrapLineToWidth = (text: string, maxWidth: number | null): string[] => {
  if (!maxWidth || cellWidth(text) <= maxWidth) return [text]
  const parts = text.split(/( \| | │ )/)
  const lines: string[] = []
  let current = ''
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    if (!part) continue
    const next = `${current}${part}`
    if (current && cellWidth(next) > maxWidth) {
      lines.push(current.trim())
      current = part.trimStart()
    } else {
      current = next
    }
  }
  if (current.trim()) lines.push(current.trim())
  return lines.length ? lines.map((line) => truncateToWidth(line, maxWidth)) : [truncateToWidth(text, maxWidth)]
}

const formatModelName = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const override = config.display.modelOverride.trim()
  let model = override || state.model.label || state.model.id || null
  if (!model) return null
  if (config.display.modelFormat === 'compact' || config.display.modelFormat === 'short') {
    model = model.replace(/\s*\([^)]*context[^)]*\)\s*$/i, '').trim()
  }
  if (config.display.modelFormat === 'short') {
    model = model.replace(/^claude\s+/i, '').trim()
  }
  return model
}

const renderModel = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showModel) return null
  const model = formatModelName(state, config)
  if (!model) return null
  const effort = config.display.showEffortLevel && state.model.effortLevel
    ? `${state.model.thinkingEnabled ? '✦ ' : ''}${state.model.effortLevel}`
    : null
  return `[${[model, effort].filter(Boolean).join(' | ')}]`
}

const renderContextValue = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const usedTokens = state.context.usedTokens
  const windowTokens = state.context.windowSize
  const usedPercent = contextUsedPercent(state)
  const remainingPercent = clampPercent(state.context.remainingPercent) ?? (usedPercent == null ? null : Math.max(0, 100 - usedPercent))
  const remainingTokens = typeof usedTokens === 'number' && Number.isFinite(usedTokens) && typeof windowTokens === 'number' && Number.isFinite(windowTokens)
    ? Math.max(0, windowTokens - usedTokens)
    : null
  const tokenLabel = typeof usedTokens === 'number' && Number.isFinite(usedTokens)
    ? (typeof windowTokens === 'number' && Number.isFinite(windowTokens)
        ? `${formatTokenCount(usedTokens, true)}/${formatTokenCount(windowTokens, true)}`
        : formatTokenCount(usedTokens, true))
    : null
  const percentLabel = percent(usedPercent)
  const remainingLabel = remainingTokens != null ? `${formatTokenCount(remainingTokens, true)} left` : (remainingPercent == null ? null : `${remainingPercent}% left`)

  switch (config.display.contextValue) {
    case 'tokens': return tokenLabel
    case 'percent': return percentLabel
    case 'remaining': return remainingLabel
    case 'both': return [percentLabel, tokenLabel ? `(${tokenLabel})` : null].filter(Boolean).join(' ') || null
  }
}

const renderAddedDirs = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showAddedDirs) return null
  const dirs = state.workspace.addedDirSlugs
  if (!dirs.length) return null
  const overflow = positiveCount(state.workspace.addedDirsOverflowCount)
  const label = `dirs ${dirs.join(', ')}${overflow ? ` +${overflow}` : ''}`
  return config.display.addedDirsLayout === 'line' ? label : label
}

const renderGit = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (config.gitStatus.enabled === false || !state.workspace.gitBranch) return null
  const branch = config.gitStatus.branchOverflow === 'truncate'
    ? truncateToWidth(state.workspace.gitBranch, 32)
    : state.workspace.gitBranch
  const parts = [
    `${branch}${config.gitStatus.showDirty && state.workspace.gitDirty ? '*' : ''}`,
    config.gitStatus.showAheadBehind && positiveCount(state.workspace.gitAhead) ? `↑${positiveCount(state.workspace.gitAhead)}` : null,
    config.gitStatus.showAheadBehind && positiveCount(state.workspace.gitBehind) ? `↓${positiveCount(state.workspace.gitBehind)}` : null,
    config.gitStatus.showFileStats && positiveCount(state.cost.totalLinesAdded) ? `+${positiveCount(state.cost.totalLinesAdded)}` : null,
    config.gitStatus.showFileStats && positiveCount(state.cost.totalLinesRemoved) ? `-${positiveCount(state.cost.totalLinesRemoved)}` : null,
  ].filter(Boolean)
  return `git:(${parts.join(' ')})`
}

const renderSessionTokens = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showSessionTokens) return null
  const input = positiveCount(state.tokens.input)
  const output = positiveCount(state.tokens.output)
  const cache = positiveCount(state.tokens.cacheCreationInput) + positiveCount(state.tokens.cacheReadInput)
  const total = input + output + cache
  if (!total) return null

  const detailParts = config.display.showTokenBreakdown
    ? [
        input ? `in: ${formatTokenCount(input)}` : null,
        output ? `out: ${formatTokenCount(output)}` : null,
        cache ? `cache: ${formatTokenCount(cache)}` : null,
      ].filter(Boolean)
    : []
  return `Tokens ${formatTokenCount(total)}${detailParts.length ? ` (${detailParts.join(', ')})` : ''}`
}

const formatReset = (value: string | null | undefined): string | null => {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  const diffMs = timestamp - Date.now()
  if (diffMs <= 0) return 'now'
  return duration(diffMs)
}

const renderUsage = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showUsage) return null
  const usagePart = (label: string, usedPercent: number | null | undefined, resetAt: string | null | undefined): string | null => {
    const used = clampPercent(usedPercent)
    if (used === null) return null
    const value = config.display.usageValue === 'remaining' ? `${Math.max(0, 100 - used)}% left` : `${used}%`
    const usageBar = config.display.usageBarEnabled && !config.display.usageCompact ? `${bar(used, config, 8)} ` : ''
    const reset = config.display.showResetLabel && resetAt ? ` reset ${formatReset(resetAt)}` : ''
    return `${label} ${usageBar}${value}${reset}`
  }
  const parts = [
    usagePart('5h', state.usage.fiveHourUsedPercent, state.usage.fiveHourResetAt),
    usagePart('7d', state.usage.sevenDayUsedPercent, state.usage.sevenDayResetAt),
  ].filter(Boolean)
  return parts.length ? parts.join(config.display.usageCompact ? ' ' : ' · ') : null
}

const renderPromptCache = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showPromptCache || !state.session.lastAssistantResponseAt) return null
  const timestamp = Date.parse(state.session.lastAssistantResponseAt)
  if (!Number.isFinite(timestamp)) return null
  const remainingMs = (config.display.promptCacheTtlSeconds * 1000) - (Date.now() - timestamp)
  if (remainingMs <= 0) return 'cache expired'
  return `cache ${duration(remainingMs)} left`
}

const bytesGb = (value: number | null | undefined): string | null => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${(value / 1024 / 1024 / 1024).toFixed(1)}GB` : null
)

const renderMemory = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showMemoryUsage) return null
  const usedPercent = percent(state.system.memoryUsedPercent)
  if (!usedPercent) return null
  const memoryBar = bar(state.system.memoryUsedPercent, config, 8)
  const used = bytesGb(state.system.memoryUsedBytes)
  const total = bytesGb(state.system.memoryTotalBytes)
  return `RAM ${memoryBar ?? usedPercent} ${used && total ? `${used}/${total}` : usedPercent}`
}

const renderEnvironment = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showEnvironment) return null
  const parts = [
    state.system.claudeMdCount ? `${state.system.claudeMdCount} CLAUDE.md` : null,
    state.system.rulesCount ? `${state.system.rulesCount} rules` : null,
    state.system.mcpCount ? `${state.system.mcpCount} MCP` : null,
    state.system.hooksCount ? `${state.system.hooksCount} settings` : null,
  ].filter(Boolean)
  return parts.length ? `env ${parts.join(' · ')}` : null
}

const renderAgents = (state: NormalizedHudState, config: TerminalHudConfig, summary = false, respectDisplay = true): string | null => {
  if (respectDisplay && !config.display.showAgents) return null
  const total = positiveCount(state.activity.agentsCount)
  const running = positiveCount(state.activity.agentsRunningCount)
  if (!total && !running) return null
  const count = total || running
  if (summary) return `${running ? '◐' : '✓'} Agents ${count}${running ? ` (${running} running)` : ''}`
  return `${running ? '◐' : '✓'} Agents ${count}${running ? ` (${running} running)` : ''}`
}

const ACTIVITY_NON_TOOL_NAMES = new Set(['Task', 'Agent', 'TodoWrite', 'TodoRead', 'TaskCreate', 'TaskUpdate'])
const isRegularToolName = (name: string | null | undefined): name is string => {
  const text = name?.trim()
  if (!text) return false
  return !ACTIVITY_NON_TOOL_NAMES.has(text)
}

const renderTools = (state: NormalizedHudState, config: TerminalHudConfig, summary = false, respectDisplay = true): string | null => {
  if (respectDisplay && !config.display.showTools) return null
  const total = positiveCount(state.activity.toolsCount)
  const tool = isRegularToolName(state.activity.activeToolName) ? state.activity.activeToolName.trim() : null
  const running = Math.max(positiveCount(state.activity.toolsRunningCount), tool ? 1 : 0)
  if (!total && !running && !tool) return null
  if (!summary && tool) return `◐ ${shortToolName(tool, config)}${total ? ` · ✓ Tools ${total}` : ''}`
  const count = total || running || 1
  return `${running ? '◐' : '✓'} Tools ${count}${running ? ` (${running} running)` : ''}`
}

const renderTodos = (state: NormalizedHudState, config: TerminalHudConfig, summary = false, respectDisplay = true): string | null => {
  if (respectDisplay && !config.display.showTodos) return null
  const total = positiveCount(state.activity.todosCount)
  const active = positiveCount(state.activity.todosActiveCount)
  const completed = positiveCount(state.activity.todosCompletedCount)
  if (!total && !active && !completed) return null
  const effectiveTotal = total || active + completed
  const progress = effectiveTotal ? `(${completed}/${effectiveTotal})` : ''
  if (summary) {
    if (active) return `▸ Todo ${progress}`.trim()
    if (effectiveTotal && completed >= effectiveTotal) return `✓ Todos ${progress}`.trim()
    return `Todo ${progress}`.trim()
  }
  if (active) return `▸ Todo ${progress}`.trim()
  if (effectiveTotal && completed >= effectiveTotal) return `✓ All todos complete ${progress}`.trim()
  return null
}

const renderSessionTime = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const started = absoluteDateMinute(state.session.startedAt)
  const last = configuredTime(state.session.lastAssistantResponseAt, config)
  const parts = [
    config.display.showSessionStartDate && started ? `Started: ${started}` : null,
    config.display.showLastResponseAt && last ? `Last reply: ${last}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' │ ') : null
}

const renderSpeed = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showSpeed || typeof state.session.outputSpeed !== 'number' || !Number.isFinite(state.session.outputSpeed) || state.session.outputSpeed <= 0) return null
  return `${state.session.outputSpeed >= 10 ? Math.round(state.session.outputSpeed) : state.session.outputSpeed.toFixed(1)} tok/s`
}

const shortToolName = (toolName: string, config: TerminalHudConfig): string => {
  if (config.activityLine.toolNameFormat === 'full') return toolName
  const mcp = /^mcp__([^_]+(?:-[^_]+)*)__([\w-]+)$/i.exec(toolName)
  if (mcp) return `${mcp[1].replace(/^plugin[-_]?/i, '')}.${mcp[2]}`
  return toolName.replace(/^mcp__/i, '')
}

const meaningfulStatusText = (state: NormalizedHudState): string | null => {
  const text = state.session.statusText?.trim()
  if (!text) return null
  if (/^(active|claude code active|claude hud one)$/i.test(text)) return null
  if (/context$/i.test(text) && (state.model.label ? text.includes(state.model.label) : true)) return null
  return text
}

const renderActivity = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const items = config.activityLine.items
  const warnings = config.activityLine.warnings
  const warningParts = [
    warnings.usage && clampPercent(state.usage.fiveHourUsedPercent) !== null && clampPercent(state.usage.fiveHourUsedPercent)! >= config.display.usageThreshold && config.display.usageThreshold > 0
      ? `⚠ Usage ${percent(state.usage.fiveHourUsedPercent)}`
      : null,
    warnings.memory && clampPercent(state.system.memoryUsedPercent) !== null && clampPercent(state.system.memoryUsedPercent)! >= 90
      ? `⚠ RAM ${percent(state.system.memoryUsedPercent)}`
      : null,
    warnings.environment && config.display.environmentThreshold > 0 && state.system.mcpCount >= config.display.environmentThreshold
      ? `⚠ Env ${state.system.mcpCount}`
      : null,
    warnings.promptCache ? renderPromptCache(state, { ...config, display: { ...config.display, showPromptCache: true } }) : null,
  ].filter(Boolean)
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
  const status = meaningfulStatusText(state)
  const details = detailParts.join(' ')
  const summary = summaryParts.join(' | ')

  if (config.activityLine.mode === 'summary') return summary || status
  if (config.activityLine.mode === 'details') return details || status

  const maxWidth = config.maxWidth ?? 100
  const allowed = Math.max(20, Math.floor(maxWidth * config.activityLine.maxWidthRatio))
  if (details && cellWidth(details) <= allowed) return details
  return summary || details || status
}

export const renderTerminalHudItem = (state: NormalizedHudState, item: HudDisplayItemId, config: TerminalHudConfig): string | null => {
  switch (item) {
    case 'model': return renderModel(state, config)
    case 'contextBar': return config.display.showContextBar ? bar(contextUsedPercent(state), config) : null
    case 'contextValue': return renderContextValue(state, config)
    case 'project': return config.display.showProject ? state.session.projectSlug : null
    case 'git': return renderGit(state, config)
    case 'addedDirs': return renderAddedDirs(state, config)
    case 'tools': return renderTools(state, config)
    case 'activity': return renderActivity(state, config)
    case 'sessionTokens': return renderSessionTokens(state, config)
    case 'usage': return renderUsage(state, config)
    case 'promptCache': return renderPromptCache(state, config)
    case 'memory': return renderMemory(state, config)
    case 'environment': return renderEnvironment(state, config)
    case 'agents': return renderAgents(state, config)
    case 'todos': return renderTodos(state, config)
    case 'sessionTime': return renderSessionTime(state, config)
    case 'cost': return config.display.showCost ? dollars(state.cost.totalUsd) : null
    case 'duration': return config.display.showDuration ? duration(state.cost.totalDurationMs) : null
    case 'speed': return renderSpeed(state, config)
    case 'outputStyle': return config.display.showOutputStyle && state.model.outputStyle ? `style ${state.model.outputStyle}` : null
    case 'claudeCodeVersion': return config.display.showClaudeCodeVersion && state.model.claudeCodeVersion ? `Claude Code ${state.model.claudeCodeVersion}` : null
    case 'effortLevel': return config.display.showEffortLevel && state.model.effortLevel ? `effort ${state.model.effortLevel}${state.model.thinkingEnabled ? ' · thinking' : ''}` : null
    case 'customLine': return config.display.customLine.trim() || null
    default: return null
  }
}

export const renderTerminalHudPreviewLines = (state: NormalizedHudState, config: TerminalHudConfig): string[] => {
  if (!config.enabled) return ['Terminal HUD disabled']
  const separator = config.showSeparators ? ' │ ' : ' '
  const lines = config.rows
    .map((row) => row.map((item) => renderTerminalHudItem(state, item, config)).filter(Boolean).join(separator))
    .filter(Boolean)
  const rendered = lines.length ? lines : [`Claude HUD One · ${state.session.statusText}`]
  return rendered.flatMap((line) => config.rowOverflow === 'wrap' ? wrapLineToWidth(line, config.maxWidth) : [truncateToWidth(line, config.maxWidth)])
}
