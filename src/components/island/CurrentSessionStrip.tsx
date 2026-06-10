import type { CurrentSessionState } from '../../app/types'

type CurrentSessionStripProps = {
  session: CurrentSessionState
  sessions?: CurrentSessionState[]
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

const statusLabel = (session: CurrentSessionState): string => (
  session.activeToolName
    ? `Tool ${session.activeToolName}`
    : session.bridgeStatusText ?? session.modelLabel ?? session.lastEventLabel
)

export function CurrentSessionStrip({ session, sessions = [session] }: CurrentSessionStripProps) {
  const activityLabel = activityLabels[session.activity]
  const activityClass = `session-strip__dot session-strip__dot--${session.activity}`
  const tokenLabel = compactTokens(session.contextUsedTokens)
  const contextLabel = tokenLabel ? `${tokenLabel} context` : null
  const workspacePathLabel = shortPath(session.projectDir)
  const sessionCode = shortCode(session.sessionId ?? session.transcriptPath ?? session.sessionKey)

  return (
    <div className="session-stack">
      <aside className="session-strip" aria-label="Current Claude Code session summary">
        <div className="session-strip__status">
          <span className={activityClass} />
          <span className="session-strip__mode">{sessions.length > 1 ? `${sessions.length} sessions` : session.mode}</span>
        </div>
        <div className="session-strip__main">
          <strong>{activityLabel} · {identityLabel(session)}</strong>
          <span>{workspacePathLabel ? `Workspace ${workspacePathLabel} · ` : ''}{sessionCode ? `Session #${sessionCode} · ` : ''}updated {session.lastEventLabel}</span>
        </div>
        <div className="session-strip__metrics">
          {contextLabel ? <span>{contextLabel}</span> : null}
          <span>{statusLabel(session)}</span>
        </div>
      </aside>

      {sessions.length > 1 ? (
        <div className="session-list" aria-label="All monitored Claude Code sessions">
          {sessions.slice(0, 6).map((item, index) => {
            const itemContextLabel = compactTokens(item.contextUsedTokens)
            return (
              <div className="session-list__row" key={item.sessionKey ?? item.sessionId ?? item.transcriptPath ?? `${item.projectSlug}-${index}`}>
                <span className={`session-strip__dot session-strip__dot--${item.activity}`} />
                <strong>{activityLabels[item.activity]} · {identityLabel(item)}</strong>
                <span>{statusLabel(item)}</span>
                <em>{itemContextLabel ? `${itemContextLabel} ctx` : item.lastEventLabel}</em>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
