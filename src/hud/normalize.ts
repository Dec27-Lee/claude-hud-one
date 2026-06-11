import type { ClaudeStatusBridgeState, CurrentSessionState, IslandAppState, SessionActivityState } from '../app/types'
import type { HudLanguage, NormalizedHudState } from './types'

const safeActivity = (activity: SessionActivityState | undefined | null): SessionActivityState => activity ?? 'active'
const zeroCounts = { toolsCount: 0, agentsCount: 0, agentsRunningCount: 0, todosCount: 0, todosActiveCount: 0, todosCompletedCount: 0 }
const safeList = (values: string[] | null | undefined): string[] => Array.isArray(values) ? values.filter((value) => typeof value === 'string' && value.length > 0) : []
const safeCount = (value: number | null | undefined): number => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

export const normalizeHudState = (
  appState: IslandAppState,
  options?: {
    session?: CurrentSessionState
    bridge?: ClaudeStatusBridgeState | null
  },
): NormalizedHudState => {
  const session = options?.session ?? appState.currentSession
  const bridge = options?.bridge ?? null
  const statusText = bridge?.statusText ?? session.bridgeStatusText ?? session.lastEventLabel
  const projectSlug = bridge?.projectSlug ?? session.projectSlug ?? 'Claude Code'

  return {
    schemaVersion: 1,
    updatedAt: bridge?.updatedAt ?? session.updatedAt ?? null,
    provider: 'claude',
    language: appState.settings.language as HudLanguage,
    session: {
      sessionKey: session.sessionKey,
      sessionId: bridge?.sessionId ?? session.sessionId,
      sessionName: bridge?.sessionName ?? session.sessionName,
      projectDir: bridge?.projectDir ?? session.projectDir,
      projectSlug,
      activity: safeActivity(bridge?.activity ?? session.activity),
      sourceLabel: session.sourceLabel,
      statusText,
      permissionMode: bridge?.permissionMode ?? session.permissionMode ?? null,
      lastEventLabel: session.lastEventLabel,
      scannedAtLabel: session.scannedAtLabel,
      startedAt: bridge?.sessionStartedAt ?? session.sessionStartedAt ?? null,
      lastAssistantResponseAt: bridge?.lastAssistantResponseAt ?? session.lastAssistantResponseAt ?? null,
      outputSpeed: bridge?.outputSpeed ?? session.outputSpeed ?? null,
    },
    model: {
      id: bridge?.modelId ?? null,
      label: bridge?.modelName ?? session.modelLabel ?? null,
      outputStyle: bridge?.outputStyle ?? null,
      claudeCodeVersion: bridge?.version ?? null,
      effortLevel: bridge?.effortLevel ?? null,
      thinkingEnabled: bridge?.thinkingEnabled ?? null,
    },
    context: {
      usedPercent: bridge?.contextUsedPercent ?? session.contextUsedPercent ?? null,
      remainingPercent: bridge?.contextRemainingPercent ?? null,
      windowSize: bridge?.contextWindowSize ?? session.contextWindowSize ?? null,
      usedTokens: bridge?.contextUsedTokens ?? session.contextUsedTokens ?? null,
    },
    workspace: {
      addedDirSlugs: safeList(bridge?.addedDirSlugs ?? session.addedDirSlugs),
      addedDirsOverflowCount: safeCount(bridge?.addedDirsOverflowCount ?? session.addedDirsOverflowCount),
      gitBranch: bridge?.gitBranch ?? session.gitBranch ?? null,
      gitDirty: bridge?.gitDirty ?? session.gitDirty ?? null,
      gitAhead: bridge?.gitAhead ?? session.gitAhead ?? null,
      gitBehind: bridge?.gitBehind ?? session.gitBehind ?? null,
    },
    tokens: {
      input: bridge?.inputTokens ?? session.inputTokens ?? null,
      output: bridge?.outputTokens ?? session.outputTokens ?? null,
      cacheCreationInput: bridge?.cacheCreationInputTokens ?? session.cacheCreationInputTokens ?? null,
      cacheReadInput: bridge?.cacheReadInputTokens ?? session.cacheReadInputTokens ?? null,
      sessionInput: bridge?.inputTokens ?? session.inputTokens ?? null,
      sessionOutput: bridge?.outputTokens ?? session.outputTokens ?? null,
    },
    usage: {
      fiveHourUsedPercent: bridge?.fiveHourUsedPercent ?? null,
      fiveHourResetAt: bridge?.fiveHourResetAt ?? null,
      sevenDayUsedPercent: bridge?.sevenDayUsedPercent ?? null,
      sevenDayResetAt: bridge?.sevenDayResetAt ?? null,
    },
    cost: {
      totalUsd: bridge?.totalCostUsd ?? session.totalCostUsd ?? null,
      totalDurationMs: bridge?.totalDurationMs ?? null,
      totalApiDurationMs: bridge?.totalApiDurationMs ?? null,
      totalLinesAdded: bridge?.totalLinesAdded ?? null,
      totalLinesRemoved: bridge?.totalLinesRemoved ?? null,
    },
    activity: {
      ...zeroCounts,
      activeToolName: bridge?.toolName ?? session.activeToolName ?? null,
      toolsCount: safeCount(bridge?.toolsCount ?? session.toolsCount ?? session.toolCallRecordCount),
      toolsRunningCount: safeCount(bridge?.toolsRunningCount ?? session.toolsRunningCount ?? (bridge?.toolName || session.activeToolName ? 1 : 0)),
      agentsCount: safeCount(bridge?.agentsCount ?? session.agentsCount),
      agentsRunningCount: safeCount(bridge?.agentsRunningCount ?? session.agentsRunningCount),
      todosCount: safeCount(bridge?.todosTotalCount ?? session.todosTotalCount),
      todosActiveCount: safeCount(bridge?.todosActiveCount ?? session.todosActiveCount),
      todosCompletedCount: safeCount(bridge?.todosCompletedCount ?? session.todosCompletedCount),
    },
    system: {
      memoryUsedPercent: bridge?.memoryUsedPercent ?? session.memoryUsedPercent ?? null,
      memoryUsedBytes: bridge?.memoryUsedBytes ?? session.memoryUsedBytes ?? null,
      memoryTotalBytes: bridge?.memoryTotalBytes ?? session.memoryTotalBytes ?? null,
      claudeMdCount: safeCount(bridge?.claudeMdCount ?? session.claudeMdCount),
      rulesCount: safeCount(bridge?.rulesCount ?? session.rulesCount),
      mcpCount: safeCount(bridge?.mcpCount ?? session.mcpCount),
      hooksCount: safeCount(bridge?.hooksCount ?? session.hooksCount),
    },
    diagnostics: {
      transcriptPath: bridge?.transcriptPath ?? session.transcriptPath,
      transcriptCount: session.transcriptCount,
      totalEventCount: session.totalEventCount,
      assistantEventCount: session.assistantEventCount,
      userEventCount: session.userEventCount,
      toolCallRecordCount: session.toolCallRecordCount,
      toolResultFileCount: session.toolResultFileCount,
      privacyNote: session.privacyNote,
    },
  }
}
