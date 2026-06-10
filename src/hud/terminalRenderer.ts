import type { TerminalHudConfig } from './config'
import type { HudDisplayItemId, NormalizedHudState } from './types'

const compactTokens = (tokens: number | null | undefined): string | null => {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return null
  if (tokens < 1_000) return `${Math.round(tokens)} tokens`
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}K`
  return `${Math.round(tokens / 1_000)}K`
}

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

const configuredTime = (value: string | null | undefined, config: TerminalHudConfig): string | null => {
  if (config.display.timeFormat === 'absolute') return clockTime(value)
  if (config.display.timeFormat === 'both') return [clockTime(value), relativeTime(value)].filter(Boolean).join(' / ') || null
  return relativeTime(value)
}

const contextUsedPercent = (state: NormalizedHudState): number | null => {
  const direct = clampPercent(state.context.usedPercent)
  if (direct !== null) return direct
  if (typeof state.context.usedTokens === 'number' && Number.isFinite(state.context.usedTokens) && state.context.usedTokens > 0 &&
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
  const remainingTokens = typeof usedTokens === 'number' && typeof windowTokens === 'number'
    ? Math.max(0, windowTokens - usedTokens)
    : null
  const tokenLabel = typeof usedTokens === 'number' && Number.isFinite(usedTokens)
    ? (typeof windowTokens === 'number' && Number.isFinite(windowTokens) ? `${compactTokens(usedTokens)}/${compactTokens(windowTokens)}` : compactTokens(usedTokens))
    : null
  const percentLabel = percent(usedPercent)
  const remainingLabel = remainingTokens != null ? `${compactTokens(remainingTokens)} left` : (remainingPercent == null ? null : `${remainingPercent}% left`)

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
  return `git: ${parts.join(' ')}`
}

const renderSessionTokens = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showSessionTokens) return null
  const parts = [
    state.tokens.input ? `in ${compactTokens(state.tokens.input)}` : null,
    state.tokens.output ? `out ${compactTokens(state.tokens.output)}` : null,
    config.display.showTokenBreakdown && (state.tokens.cacheCreationInput || state.tokens.cacheReadInput)
      ? `cache ${compactTokens((state.tokens.cacheCreationInput ?? 0) + (state.tokens.cacheReadInput ?? 0))}`
      : null,
  ].filter(Boolean)
  return parts.length ? `tokens ${parts.join(' ')}` : null
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

const renderAgents = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showAgents) return null
  const total = positiveCount(state.activity.agentsCount)
  const running = positiveCount(state.activity.agentsRunningCount)
  if (!total && !running) return null
  return `agents ${total || running}${running ? ` (${running} running)` : ''}`
}

const renderTodos = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showTodos) return null
  const total = positiveCount(state.activity.todosCount)
  const active = positiveCount(state.activity.todosActiveCount)
  const completed = positiveCount(state.activity.todosCompletedCount)
  if (!total && !active && !completed) return null
  if (total) return `todos ${completed}/${total}${active ? ` · ${active} active` : ''}`
  return `todos ${active || completed}`
}

const renderSessionTime = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const parts = [
    config.display.showSessionStartDate ? `start ${configuredTime(state.session.startedAt, config)}` : null,
    config.display.showLastResponseAt ? `last ${configuredTime(state.session.lastAssistantResponseAt, config)}` : null,
  ].filter(Boolean)
  return parts.length ? `session ${parts.join(' · ')}` : null
}

const renderSpeed = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  if (!config.display.showSpeed || typeof state.session.outputSpeed !== 'number' || !Number.isFinite(state.session.outputSpeed) || state.session.outputSpeed <= 0) return null
  return `${state.session.outputSpeed >= 10 ? Math.round(state.session.outputSpeed) : state.session.outputSpeed.toFixed(1)} tok/s`
}

const renderActivity = (state: NormalizedHudState, config: TerminalHudConfig): string | null => {
  const items = config.activityLine.items
  const warnings = config.activityLine.warnings
  const details = [
    items.tools !== false && state.activity.activeToolName ? `tool ${config.activityLine.toolNameFormat === 'short' ? state.activity.activeToolName.replace(/^mcp__/i, '') : state.activity.activeToolName}` : null,
    items.agents !== false ? renderAgents(state, config) : null,
    items.todos !== false ? renderTodos(state, config) : null,
    items.sessionTime === true ? renderSessionTime(state, config) : null,
  ].filter(Boolean)
  const warningParts = [
    warnings.usage && clampPercent(state.usage.fiveHourUsedPercent) !== null && clampPercent(state.usage.fiveHourUsedPercent)! >= config.display.usageThreshold && config.display.usageThreshold > 0
      ? `usage ${percent(state.usage.fiveHourUsedPercent)}`
      : null,
    warnings.memory && clampPercent(state.system.memoryUsedPercent) !== null && clampPercent(state.system.memoryUsedPercent)! >= 90
      ? `RAM ${percent(state.system.memoryUsedPercent)}`
      : null,
    warnings.environment && config.display.environmentThreshold > 0 && state.system.mcpCount >= config.display.environmentThreshold
      ? `env ${state.system.mcpCount}`
      : null,
    warnings.promptCache ? renderPromptCache(state, { ...config, display: { ...config.display, showPromptCache: true } }) : null,
  ].filter(Boolean)
  const status = [state.session.activity, state.session.statusText].filter(Boolean).join(' · ')
  if (config.activityLine.mode === 'summary') return [status, ...warningParts].filter(Boolean).join(' · ') || null
  if (config.activityLine.mode === 'details') return [...details, ...warningParts].filter(Boolean).join(' · ') || status || null
  return [status, ...details, ...warningParts].filter(Boolean).join(' · ') || null
}

export const renderTerminalHudItem = (state: NormalizedHudState, item: HudDisplayItemId, config: TerminalHudConfig): string | null => {
  switch (item) {
    case 'model': return renderModel(state, config)
    case 'contextBar': return config.display.showContextBar ? bar(contextUsedPercent(state), config) : null
    case 'contextValue': return renderContextValue(state, config)
    case 'project': return config.display.showProject ? state.session.projectSlug : null
    case 'git': return renderGit(state, config)
    case 'addedDirs': return renderAddedDirs(state, config)
    case 'tools': return config.display.showTools && state.activity.activeToolName ? `Tool ${state.activity.activeToolName}` : null
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
