import type { AppLanguage, CurrentSessionState } from '../../app/types'
import type { HudDisplayItemId } from '../../hud/types'

export type ClawdMood = 'idle' | 'working' | 'alert'
export type DesktopHudLanguage = Extract<AppLanguage, 'en' | 'zh-CN'>

export const resolveDesktopHudLanguage = (language: AppLanguage): DesktopHudLanguage => (
  language === 'zh-CN' ? 'zh-CN' : 'en'
)

export const sessionActivityLabels: Record<DesktopHudLanguage, Record<CurrentSessionState['activity'], string>> = {
  en: {
    idle: 'Idle',
    active: 'Active',
    running: 'Running',
    waiting: 'Waiting',
    error: 'Error',
  },
  'zh-CN': {
    idle: '空闲',
    active: '活跃',
    running: '运行中',
    waiting: '等待中',
    error: '异常',
  },
}

export const sessionActivityLabel = (activity: CurrentSessionState['activity'], language: DesktopHudLanguage = 'en'): string => (
  sessionActivityLabels[language][activity]
)

export const pathBaseName = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? null
}

export const compactLabel = (value: string, maxLength = 18): string => (
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
)

export const compactTokens = (tokens: number | null | undefined): string | null => {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return null
  if (tokens < 1_000) return `${Math.round(tokens)} tokens`
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}K`
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}K`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

export const sessionTokenTotal = (session: CurrentSessionState): number | null => {
  const total = [session.inputTokens, session.outputTokens, session.cacheCreationInputTokens, session.cacheReadInputTokens]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0)
  return total > 0 ? total : null
}

export const positiveCount = (value: number | null | undefined): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
)

export const shortCode = (value: string | null | undefined): string | null => {
  if (!value) return null
  const leaf = pathBaseName(value) ?? value
  const cleaned = leaf.replace(/\.jsonl$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '')
  if (!cleaned) return null
  return cleaned.length <= 8 ? cleaned : cleaned.slice(0, 8)
}

export const workspaceLabel = (session: CurrentSessionState): string => (
  pathBaseName(session.projectDir) ?? session.projectSlug ?? 'Claude Code'
)

export const sessionLabel = (session: CurrentSessionState): string => {
  const workspace = workspaceLabel(session).toLowerCase()
  const name = session.sessionName?.trim()
  if (name && name.toLowerCase() !== workspace && !name.includes('\\') && !name.includes('/')) {
    return compactLabel(name, 18)
  }

  return `#${shortCode(session.sessionId ?? session.transcriptPath ?? session.sessionKey) ?? 'session'}`
}

export const identityLabel = (session: CurrentSessionState): string => `${workspaceLabel(session)} ${sessionLabel(session)}`

export const sessionKey = (session: CurrentSessionState, index: number): string => (
  session.sessionKey ?? session.sessionId ?? session.transcriptPath ?? `${workspaceLabel(session)}-${index}`
)

export const moodForActivity = (activity: CurrentSessionState['activity']): ClawdMood => {
  if (activity === 'waiting' || activity === 'error') return 'alert'
  if (activity === 'running') return 'working'
  return 'idle'
}

const translateStatusText = (value: string | null | undefined, language: DesktopHudLanguage): string | null => {
  if (!value) return null
  if (language !== 'zh-CN') return value
  const toolRunning = value.match(/^Tool running: (.+)$/)
  if (toolRunning) return `工具运行中：${toolRunning[1]}`
  const toolFinished = value.match(/^Tool finished: (.+)$/)
  if (toolFinished) return `工具已完成：${toolFinished[1]}`
  const exact: Record<string, string> = {
    'Generating response': '正在生成回复',
    'Tool running': '工具运行中',
    'Tool finished': '工具已完成',
    'Needs attention': '需要处理',
    'Waiting for user': '等待用户',
    'Run failed': '运行失败',
    'Session started': '会话已开始',
    'Session ended': '会话已结束',
    'Compacting context': '正在压缩上下文',
    'Working directory changed': '工作目录已变更',
  }
  return exact[value] ?? value
}

export const sessionStatusText = (session: CurrentSessionState, isVisible: (item: HudDisplayItemId) => boolean, language: DesktopHudLanguage = 'en'): string | null => {
  if (isVisible('tools') && session.activeToolName) return language === 'zh-CN' ? `工具 ${session.activeToolName}` : `Tool ${session.activeToolName}`
  if (isVisible('activity') && session.bridgeStatusText) return translateStatusText(session.bridgeStatusText, language)
  if (isVisible('model') && session.modelLabel) return session.modelLabel
  return isVisible('activity') ? translateStatusText(session.lastEventLabel, language) ?? session.sourceLabel : null
}

export const desktopItemLabel = (session: CurrentSessionState, item: HudDisplayItemId, isVisible: (item: HudDisplayItemId) => boolean, language: DesktopHudLanguage = 'en'): string | null => {
  if (!isVisible(item)) return null
  switch (item) {
    case 'activity': return [sessionActivityLabel(session.activity, language), translateStatusText(session.bridgeStatusText ?? session.lastEventLabel, language)].filter(Boolean).join(' · ')
    case 'project': return identityLabel(session)
    case 'model': return session.modelLabel ?? null
    case 'tools': return session.activeToolName ? `${language === 'zh-CN' ? '工具' : 'Tool'} ${session.activeToolName}` : null
    case 'contextValue': return compactTokens(session.contextUsedTokens) ? `${compactTokens(session.contextUsedTokens)} ${language === 'zh-CN' ? '上下文' : 'context'}` : null
    case 'sessionTokens': return compactTokens(sessionTokenTotal(session)) ? `${compactTokens(sessionTokenTotal(session))} ${language === 'zh-CN' ? '会话 tokens' : 'tokens'}` : null
    case 'cost': return typeof session.totalCostUsd === 'number' && session.totalCostUsd > 0 ? `$${session.totalCostUsd.toFixed(session.totalCostUsd < 10 ? 2 : 1)}` : null
    case 'git': return session.gitBranch ? `git ${session.gitBranch}${session.gitDirty ? '*' : ''}` : null
    case 'addedDirs': return session.addedDirSlugs?.length ? `${language === 'zh-CN' ? '目录' : 'dirs'} ${session.addedDirSlugs.join(', ')}` : null
    case 'agents': return positiveCount(session.agentsCount) || positiveCount(session.agentsRunningCount) ? `${language === 'zh-CN' ? '代理' : 'agents'} ${positiveCount(session.agentsCount) || positiveCount(session.agentsRunningCount)}` : null
    case 'todos': return positiveCount(session.todosTotalCount) ? `${language === 'zh-CN' ? '待办' : 'todos'} ${positiveCount(session.todosCompletedCount)}/${positiveCount(session.todosTotalCount)}` : null
    case 'speed': return typeof session.outputSpeed === 'number' && session.outputSpeed > 0 ? `${session.outputSpeed >= 10 ? Math.round(session.outputSpeed) : session.outputSpeed.toFixed(1)} tok/s` : null
    default: return null
  }
}

export const sessionTickerText = (session: CurrentSessionState, isVisible: (item: HudDisplayItemId) => boolean, tickerItems: HudDisplayItemId[], language: DesktopHudLanguage = 'en'): string => {
  const items: HudDisplayItemId[] = tickerItems.length ? tickerItems : ['activity', 'project', 'tools']
  const parts = items.map((item) => desktopItemLabel(session, item, isVisible, language)).filter(Boolean)
  return parts.join(' · ') || sessionStatusText(session, isVisible, language) || 'Claude HUD One'
}

export const sortedSessions = (sessions: CurrentSessionState[]): CurrentSessionState[] => {
  const rank: Record<CurrentSessionState['activity'], number> = { waiting: 0, running: 1, error: 2, active: 3, idle: 4 }
  return [...sessions].sort((left, right) => {
    const rankDiff = rank[left.activity] - rank[right.activity]
    if (rankDiff !== 0) return rankDiff
    return Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '')
  })
}
