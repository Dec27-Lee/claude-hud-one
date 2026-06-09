import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODE = process.argv.includes('--hook') ? 'hook' : 'statusLine'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..', '..')
const PROJECT_STATE_PATH = resolve(SCRIPT_DIR, 'state', 'claude-status.json')
const APPDATA_STATE_PATH = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'Claude Island Win', 'claude-status.json')
  : null
const HUD_PLUS_STATUSLINE_PATH = process.env.CLAUDE_HUD_PLUS_STATUSLINE
  ?? (process.env.USERPROFILE ? resolve(process.env.USERPROFILE, '.claude', 'plugins', 'claude-hud-plus', 'statusline.ps1') : null)
const HUD_PLUS_TIMEOUT_MS = Number(process.env.CLAUDE_ISLAND_HUD_PLUS_TIMEOUT_MS ?? 2_200)

const FALLBACK_STATUS = 'Claude Island'
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

const baseName = (value) => {
  if (!value || typeof value !== 'string') return null
  const normalized = value.replaceAll('\\', '/')
  return normalized.split('/').filter(Boolean).at(-1) ?? null
}

const compactPercent = (value) => {
  const number = numberOrNull(value)
  if (number === null) return null
  return Math.max(0, Math.min(100, Math.round(number)))
}

const sanitizeToolName = (input) => stringOrNull(input?.tool_name ?? input?.toolName ?? input?.tool?.name)
const sanitizeHookEvent = (input) => stringOrNull(input?.hook_event_name ?? input?.hookEventName ?? input?.event)

const activityFromHook = (hookEvent) => {
  switch (hookEvent) {
    case 'UserPromptSubmit':
    case 'PreToolUse':
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
    case 'UserPromptSubmit': return 'Prompt submitted'
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
  const modelName = stringOrNull(model?.display_name) ?? stringOrNull(model?.id)
  const projectDir = stringOrNull(workspace?.project_dir) ?? stringOrNull(input?.cwd)
  const projectSlug = stringOrNull(input?.session_name) ?? baseName(projectDir) ?? 'Claude Code'
  const statusText = [
    modelName,
    usedPercentage === null ? null : `ctx ${usedPercentage}%`,
  ].filter(Boolean).join(' · ') || 'Claude Code active'

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
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
    contextWindowSize: numberOrNull(context?.context_window_size),
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
    privacyNote: 'Claude Island bridge stores only sanitized status metrics. It does not store prompt, transcript, tool-result or credential content.',
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
    event: 'hook',
    activity: activityFromHook(hookEvent),
    statusText: statusTextFromHook(hookEvent, toolName),
    sessionId: stringOrNull(input?.session_id),
    sessionName: stringOrNull(input?.session_name),
    cwd,
    projectDir,
    projectSlug: stringOrNull(input?.session_name) ?? baseName(projectDir) ?? 'Claude Code',
    transcriptPath: stringOrNull(input?.transcript_path),
    modelId: null,
    modelName: null,
    version: stringOrNull(input?.version),
    outputStyle: null,
    contextUsedPercent: null,
    contextRemainingPercent: null,
    contextWindowSize: null,
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
    privacyNote: 'Claude Island hook bridge stores only event name, tool name and sanitized status metadata. It does not store user prompt, tool input, tool result, transcript or credential content.',
  }
}

const mergeWithPrevious = (nextState, previousState) => {
  if (!previousState || typeof previousState !== 'object') return nextState

  const keepFromPrevious = [
    'modelId', 'modelName', 'contextUsedPercent', 'contextRemainingPercent', 'contextWindowSize',
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
  return merged
}

const readPreviousState = () => {
  try {
    return JSON.parse(readFileSync(APPDATA_STATE_PATH ?? PROJECT_STATE_PATH, 'utf8'))
  } catch {
    return null
  }
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
    // Fall back to the compact Claude Island status line.
  }

  return null
}

try {
  const text = await readStdin()
  const cleanText = text.replace(/^﻿/, '')
  const input = cleanText.trim() ? JSON.parse(cleanText) : {}
  const previousState = readPreviousState()
  const nextState = mergeWithPrevious(MODE === 'hook' ? summarizeHook(input) : summarizeStatusLine(input), previousState)
  writeStateFile(APPDATA_STATE_PATH, nextState)
  writeStateFile(PROJECT_STATE_PATH, nextState)

  const fallbackStatusLineText = MODE === 'statusLine'
    ? `Claude Island · ${nextState.statusText}`
    : ''
  complete(hudPlusStatusLine(cleanText) ?? fallbackStatusLineText)
} catch {
  complete(FALLBACK_STATUS)
}
