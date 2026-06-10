import type { CurrentSessionState } from '../../app/types'
import type { HudDisplayItemId } from '../../hud/types'

type CurrentSessionStripProps = {
  session: CurrentSessionState
  sessions?: CurrentSessionState[]
  visibleItems?: Partial<Record<HudDisplayItemId, boolean>>
  panelItems?: HudDisplayItemId[]
}

const activityLabels: Record<CurrentSessionState['activity'], string> = {
  idle: 'Idle',
  active: 'Active',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
}

const compactTokens = (tokens: number | null | undefined): string | null => {
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return null
  if (tokens < 1_000) return `${Math.round(tokens)} tokens`
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}K`
  return `${Math.round(tokens / 1_000)}K`
}

const positiveCount = (value: number | null | undefined): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
)

const pathBaseName = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? null
}

const shortPath = (value: string | null | undefined): string | null => {
  const name = pathBaseName(value)
  return name ? `…\\${name}` : null
}

const compactLabel = (value: string, maxLength = 22): string => (
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
)

const shortCode = (value: string | null | undefined): string | null => {
  if (!value) return null
  const leaf = pathBaseName(value) ?? value
  const cleaned = leaf.replace(/\.jsonl$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '')
  if (!cleaned) return null
  return cleaned.length <= 8 ? cleaned : cleaned.slice(0, 8)
}

const workspaceLabel = (session: CurrentSessionState): string => (
  pathBaseName(session.projectDir) ?? session.projectSlug ?? 'Claude Code'
)

const sessionLabel = (session: CurrentSessionState): string => {
  const workspace = workspaceLabel(session).toLowerCase()
  const name = session.sessionName?.trim()
  if (name && name.toLowerCase() !== workspace && !name.includes('\\') && !name.includes('/')) {
    return compactLabel(name, 22)
  }

  return `#${shortCode(session.sessionId ?? session.transcriptPath ?? session.sessionKey) ?? 'session'}`
}

const identityLabel = (session: CurrentSessionState): string => `${workspaceLabel(session)} / ${sessionLabel(session)}`

const statusLabel = (session: CurrentSessionState, isVisible: (item: HudDisplayItemId) => boolean): string | null => {
  if (isVisible('tools') && session.activeToolName) return `Tool ${session.activeToolName}`
  if (isVisible('activity') && session.bridgeStatusText) return session.bridgeStatusText
  if (isVisible('model') && session.modelLabel) return session.modelLabel
  return isVisible('activity') ? session.lastEventLabel : null
}

const panelItemLabel = (session: CurrentSessionState, item: HudDisplayItemId, isVisible: (item: HudDisplayItemId) => boolean): string | null => {
  if (!isVisible(item)) return null
  switch (item) {
    case 'activity': return statusLabel(session, isVisible)
    case 'project': return identityLabel(session)
    case 'model': return session.modelLabel ?? null
    case 'tools': return session.activeToolName ? `Tool ${session.activeToolName}` : null
    case 'contextValue': return compactTokens(session.contextUsedTokens) ? `${compactTokens(session.contextUsedTokens)} context` : null
    case 'sessionTokens': return compactTokens(session.contextUsedTokens) ? `${compactTokens(session.contextUsedTokens)} tokens` : null
    case 'cost': return typeof session.totalCostUsd === 'number' && session.totalCostUsd > 0 ? `$${session.totalCostUsd.toFixed(session.totalCostUsd < 10 ? 2 : 1)}` : null
    case 'git': return session.gitBranch ? `git ${session.gitBranch}${session.gitDirty ? '*' : ''}` : null
    case 'addedDirs': return session.addedDirSlugs?.length ? `dirs ${session.addedDirSlugs.join(', ')}` : null
    case 'agents': return positiveCount(session.agentsCount) || positiveCount(session.agentsRunningCount) ? `agents ${positiveCount(session.agentsCount) || positiveCount(session.agentsRunningCount)}` : null
    case 'todos': return positiveCount(session.todosTotalCount) ? `todos ${positiveCount(session.todosCompletedCount)}/${positiveCount(session.todosTotalCount)}` : null
    case 'speed': return typeof session.outputSpeed === 'number' && session.outputSpeed > 0 ? `${session.outputSpeed >= 10 ? Math.round(session.outputSpeed) : session.outputSpeed.toFixed(1)} tok/s` : null
    default: return null
  }
}

export function CurrentSessionStrip({ session, sessions = [session], visibleItems, panelItems = ['contextValue', 'tools', 'model'] }: CurrentSessionStripProps) {
  const isVisible = (item: HudDisplayItemId): boolean => visibleItems?.[item] !== false
  const activityLabel = activityLabels[session.activity]
  const activityClass = `session-strip__dot session-strip__dot--${session.activity}`
  const workspacePathLabel = isVisible('project') ? shortPath(session.projectDir) : null
  const sessionCode = isVisible('project') ? shortCode(session.sessionId ?? session.transcriptPath ?? session.sessionKey) : null
  const metricLabels = panelItems.map((item) => panelItemLabel(session, item, isVisible)).filter(Boolean)

  return (
    <div className="session-stack">
      <aside className="session-strip" aria-label="Current Claude Code session summary">
        <div className="session-strip__status">
          {isVisible('activity') ? <span className={activityClass} /> : null}
          <span className="session-strip__mode">{sessions.length > 1 ? `${sessions.length} sessions` : session.mode}</span>
        </div>
        <div className="session-strip__main">
          <strong>{[isVisible('activity') ? activityLabel : null, isVisible('project') ? identityLabel(session) : null].filter(Boolean).join(' · ') || 'Claude HUD One session'}</strong>
          <span>{workspacePathLabel ? `Workspace ${workspacePathLabel} · ` : ''}{sessionCode ? `Session #${sessionCode} · ` : ''}updated {session.lastEventLabel}</span>
        </div>
        <div className="session-strip__metrics">
          {metricLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </aside>

      {sessions.length > 1 ? (
        <div className="session-list" aria-label="All monitored Claude Code sessions">
          {sessions.slice(0, 6).map((item, index) => {
            const itemContextLabel = compactTokens(item.contextUsedTokens)
            const itemStatus = statusLabel(item, isVisible)
            return (
              <div className="session-list__row" key={item.sessionKey ?? item.sessionId ?? item.transcriptPath ?? `${item.projectSlug}-${index}`}>
                {isVisible('activity') ? <span className={`session-strip__dot session-strip__dot--${item.activity}`} /> : <span />}
                <strong>{[isVisible('activity') ? activityLabels[item.activity] : null, isVisible('project') ? identityLabel(item) : null].filter(Boolean).join(' · ') || 'Claude HUD One session'}</strong>
                <span>{itemStatus ?? item.lastEventLabel}</span>
                <em>{itemContextLabel && (isVisible('contextValue') || isVisible('sessionTokens')) ? `${itemContextLabel} ctx` : item.lastEventLabel}</em>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
