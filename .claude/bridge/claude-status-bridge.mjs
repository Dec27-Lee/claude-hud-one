import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
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
const UPSTREAM_STATUSLINE_PATH = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Claude HUD One', 'bridge', 'upstream-statusline.json')
  : null
const HUD_PLUS_STATUSLINE_PATH = process.env.CLAUDE_HUD_PLUS_STATUSLINE
  ?? (process.env.USERPROFILE ? resolve(process.env.USERPROFILE, '.claude', 'plugins', 'claude-hud-plus', 'statusline.ps1') : null)
const HUD_PLUS_TIMEOUT_MS = Number(process.env.CLAUDE_HUD_ONE_HUD_PLUS_TIMEOUT_MS ?? 4_000)
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

const failSafe = setTimeout(() => complete(FALLBACK_STATUS), Math.max(HUD_PLUS_TIMEOUT_MS + 500, 2_700))
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

const formatTokenK = (tokens) => {
  const number = positiveNumberOrNull(tokens)
  if (number === null) return null
  if (number < 1_000) return `${Math.round(number)} tokens`
  if (number < 10_000) return `${(number / 1_000).toFixed(1)}K`
  return `${Math.round(number / 1_000)}K`
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

const summarizeStatusLine = (input) => {
  const context = input?.context_window ?? {}
  const currentUsage = context?.current_usage ?? {}
  const cost = input?.cost ?? {}
  const model = input?.model ?? {}
  const workspace = input?.workspace ?? {}
  const rateLimits = input?.rate_limits ?? {}
  const usedPercentage = compactPercent(context?.used_percentage)
  const contextWindowSize = numberOrNull(context?.context_window_size)
  const currentUsageTokens = sumPositive(
    currentUsage?.input_tokens,
    currentUsage?.output_tokens,
    currentUsage?.cache_creation_input_tokens,
    currentUsage?.cache_read_input_tokens,
  )
  const totalUsageTokens = sumPositive(context?.total_input_tokens, context?.total_output_tokens)
  const percentUsageTokens = usedPercentage !== null && contextWindowSize !== null
    ? (contextWindowSize * usedPercentage) / 100
    : null
  const contextUsedTokens = currentUsageTokens ?? totalUsageTokens ?? percentUsageTokens
  const contextTokenLabel = formatTokenK(contextUsedTokens)
  const modelName = stringOrNull(model?.display_name) ?? stringOrNull(model?.id)
  const projectDir = stringOrNull(workspace?.project_dir) ?? stringOrNull(input?.cwd)
  const projectSlug = baseName(projectDir) ?? stringOrNull(input?.session_name) ?? 'Claude Code'
  const statusText = [
    modelName,
    contextTokenLabel ? `${contextTokenLabel} context` : null,
  ].filter(Boolean).join(' · ') || 'Claude Code active'

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
    transcriptPath: stringOrNull(input?.transcript_path),
    modelId: stringOrNull(model?.id),
    modelName,
    version: stringOrNull(input?.version),
    outputStyle: stringOrNull(input?.output_style?.name),
    contextUsedPercent: usedPercentage,
    contextRemainingPercent: compactPercent(context?.remaining_percentage),
    contextWindowSize,
    contextUsedTokens: positiveNumberOrNull(contextUsedTokens),
    inputTokens: numberOrNull(currentUsage?.input_tokens ?? context?.total_input_tokens),
    outputTokens: numberOrNull(currentUsage?.output_tokens ?? context?.total_output_tokens),
    cacheCreationInputTokens: numberOrNull(currentUsage?.cache_creation_input_tokens),
    cacheReadInputTokens: numberOrNull(currentUsage?.cache_read_input_tokens),
    totalCostUsd: numberOrNull(cost?.total_cost_usd),
    totalDurationMs: numberOrNull(cost?.total_duration_ms),
    totalApiDurationMs: numberOrNull(cost?.total_api_duration_ms),
    totalLinesAdded: numberOrNull(cost?.total_lines_added),
    totalLinesRemoved: numberOrNull(cost?.total_lines_removed),
    fiveHourUsedPercent: compactPercent(rateLimits?.five_hour?.used_percentage),
    fiveHourResetAt: stringOrNull(rateLimits?.five_hour?.resets_at),
    sevenDayUsedPercent: compactPercent(rateLimits?.seven_day?.used_percentage),
    sevenDayResetAt: stringOrNull(rateLimits?.seven_day?.resets_at),
    effortLevel: stringOrNull(input?.effort?.level),
    thinkingEnabled: boolOrNull(input?.thinking?.enabled),
    agentName: stringOrNull(input?.agent?.name),
    hookEventName: null,
    toolName: null,
    source: 'statusLine',
    privacyNote: 'Claude HUD One bridge stores only sanitized status metrics. It does not store prompt, transcript, tool-result or credential content.',
  }
}

const summarizeHook = (input) => {
  const hookEvent = sanitizeHookEvent(input) ?? 'Hook'
  const toolName = sanitizeToolName(input)
  const cwd = stringOrNull(input?.cwd)
  const projectDir = stringOrNull(input?.workspace?.project_dir) ?? cwd

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    activityStartedAt: new Date().toISOString(),
    event: 'hook',
    activity: activityFromHook(hookEvent),
    statusText: statusTextFromHook(hookEvent, toolName),
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
    inputTokens: null,
    outputTokens: null,
    cacheCreationInputTokens: null,
    cacheReadInputTokens: null,
    totalCostUsd: null,
    totalDurationMs: null,
    totalApiDurationMs: null,
    totalLinesAdded: null,
    totalLinesRemoved: null,
    fiveHourUsedPercent: null,
    sevenDayUsedPercent: null,
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
    'modelId', 'modelName', 'contextUsedPercent', 'contextRemainingPercent', 'contextWindowSize', 'contextUsedTokens',
    'inputTokens', 'outputTokens', 'cacheCreationInputTokens', 'cacheReadInputTokens',
    'totalCostUsd', 'totalDurationMs', 'totalApiDurationMs', 'totalLinesAdded', 'totalLinesRemoved',
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

const commandLooksLikeSelf = (command) => typeof command === 'string' && command.toLowerCase().includes('claude-status-bridge.mjs')

const upstreamStatusLine = (stdinText) => {
  if (MODE !== 'statusLine' || !UPSTREAM_STATUSLINE_PATH || !existsSync(UPSTREAM_STATUSLINE_PATH)) return null

  try {
    const config = JSON.parse(readFileSync(UPSTREAM_STATUSLINE_PATH, 'utf8'))
    const command = stringOrNull(config?.command)
    if (!command || commandLooksLikeSelf(command)) return null

    const result = spawnSync(
      process.platform === 'win32' ? 'cmd.exe' : 'sh',
      process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command],
      {
        input: stdinText,
        encoding: 'utf8',
        timeout: HUD_PLUS_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 512 * 1024,
      },
    )

    if (result.status === 0 && typeof result.stdout === 'string' && result.stdout.trim().length > 0) {
      return result.stdout.trimEnd()
    }
  } catch {
    // Fall back to HUD Plus auto-detection or the compact Claude HUD One status line.
  }

  return null
}

const hudPlusStatusLine = (stdinText) => {
  if (MODE !== 'statusLine' || !HUD_PLUS_STATUSLINE_PATH || !existsSync(HUD_PLUS_STATUSLINE_PATH)) return null

  try {
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HUD_PLUS_STATUSLINE_PATH],
      {
        input: stdinText,
        encoding: 'utf8',
        timeout: HUD_PLUS_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 512 * 1024,
      },
    )

    if (result.status === 0 && typeof result.stdout === 'string' && result.stdout.trim().length > 0) {
      return result.stdout.trimEnd()
    }
  } catch {
    // Fall back to the compact Claude HUD One status line.
  }

  return null
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
  complete(upstreamStatusLine(cleanText) ?? hudPlusStatusLine(cleanText) ?? fallbackStatusLineText)
} catch {
  complete(FALLBACK_STATUS)
}
