import type { CurrentSessionState } from '../../app/types'

type CurrentSessionStripProps = {
  session: CurrentSessionState
}

const activityLabels: Record<CurrentSessionState['activity'], string> = {
  idle: 'Idle',
  active: 'Active',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
}

export function CurrentSessionStrip({ session }: CurrentSessionStripProps) {
  const activityLabel = activityLabels[session.activity]
  const activityClass = `session-strip__dot session-strip__dot--${session.activity}`
  const contextLabel = typeof session.contextUsedPercent === 'number' ? `${Math.round(session.contextUsedPercent)}% ctx` : null
  const modelLabel = session.modelLabel ?? null
  const toolLabel = session.activeToolName ? `${session.activeToolName}` : null

  return (
    <aside className="session-strip" aria-label="Current Claude Code session summary">
      <div className="session-strip__status">
        <span className={activityClass} />
        <span className="session-strip__mode">{session.mode}</span>
      </div>
      <div className="session-strip__main">
        <strong>{activityLabel} · {session.projectSlug}</strong>
        <span>{session.sourceLabel} · updated {session.lastEventLabel}</span>
      </div>
      <div className="session-strip__metrics">
        <span>{session.totalEventCount.toLocaleString()} events</span>
        {contextLabel ? <span>{contextLabel}</span> : <span>{session.toolCallRecordCount.toLocaleString()} tools</span>}
        {toolLabel ? <span>{toolLabel}</span> : modelLabel ? <span>{modelLabel}</span> : <span>{session.transcriptCount} files</span>}
      </div>
    </aside>
  )
}
