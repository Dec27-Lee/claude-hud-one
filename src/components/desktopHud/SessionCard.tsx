import type { CurrentSessionState } from '../../app/types'
import type { DesktopHudConfig } from '../../hud/config'
import type { HudDisplayItemId } from '../../hud/types'
import { ClawdMascot } from './ClawdMascot'
import { identityLabel, moodForActivity, sessionActivityLabel, sessionStatusText, workspaceLabel, type DesktopHudLanguage } from './sessionFormatters'

type SessionCardProps = {
  session: CurrentSessionState
  active?: boolean
  visibleItems: DesktopHudConfig['visibleItems']
  panelItems: DesktopHudConfig['panelItems']
  terminalJumpEnabled?: boolean
  terminalJumpStatus?: string | null
  language?: DesktopHudLanguage
  onJumpToTerminal?: (session: CurrentSessionState) => void
}

const ageLabel = (iso: string | null | undefined): string => {
  if (!iso) return '<1m'
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return '<1m'
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return '<1m'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

const pendingSummaryLabel = (summary: string | null | undefined, language: DesktopHudLanguage): string => {
  if (!summary) return language === 'zh-CN' ? 'Claude Code 需要处理。' : 'Claude Code needs attention.'
  if (language !== 'zh-CN') return summary
  const summaries: Record<string, string> = {
    'Claude Code is requesting permission to run a tool. Review the request in the terminal.': 'Claude Code 正在请求运行工具，请在终端里查看。',
    'A Claude Code session is waiting for your response. Review it in the terminal.': '有一个 Claude Code 会话正在等待你的回复，请到终端里处理。',
    'Claude Code is requesting attention. Review it in the terminal.': 'Claude Code 需要你处理，请到终端里查看。',
  }
  return summaries[summary] ?? summary
}

export function SessionCard({ session, active = false, visibleItems, terminalJumpEnabled = true, terminalJumpStatus = null, language = 'en', onJumpToTerminal }: SessionCardProps) {
  const isVisible = (item: HudDisplayItemId): boolean => visibleItems[item] !== false
  const statusText = terminalJumpStatus ?? sessionStatusText(session, isVisible, language) ?? session.lastEventLabel
  const terminalCwd = session.terminal?.cwd ?? session.projectDir
  const jumpDisabled = !terminalJumpEnabled || !terminalCwd || !onJumpToTerminal
  const terminalJumpFailed = Boolean(terminalJumpStatus && /fail|unavailable|not found|no /i.test(terminalJumpStatus))
  const inlinePendingItem = session.pendingQueue?.items.find((item) => item.status === 'pending') ?? null
  const tags = [
    session.modelLabel,
    session.activeToolName ? `$ ${session.activeToolName}` : null,
    session.permissionMode,
    ageLabel(session.sessionStartedAt ?? session.updatedAt),
  ].filter((label): label is string => Boolean(label)).slice(0, 4)

  return (
    <article
      className={`desktop-session-card desktop-session-card--${session.activity}${active ? ' desktop-session-card--active' : ''}${terminalJumpFailed ? ' desktop-session-card--jump-failed' : ''}`}
      aria-label="Claude Code session card"
      onClick={() => !jumpDisabled && onJumpToTerminal?.(session)}
    >
      <div className="desktop-session-card__mascot">
        <ClawdMascot mood={moodForActivity(session.activity)} activity={session.activity} size="card" />
      </div>
      <div className="desktop-session-card__body">
        <div className="desktop-session-card__head">
          <strong>{isVisible('project') ? identityLabel(session) : workspaceLabel(session)}</strong>
          <span className={`desktop-session-card__activity desktop-session-card__activity--${session.activity}`}>{sessionActivityLabel(session.activity, language)}</span>
        </div>
        <p>{statusText}</p>
        <div className="desktop-session-card__meta">
          {tags.map((label) => <span key={label}>{label}</span>)}
        </div>
        {inlinePendingItem ? (
          <div className={`desktop-session-card__pending desktop-session-card__pending--${inlinePendingItem.kind}`}>
            <span>{inlinePendingItem.kind === 'approval' ? '!' : '?'}</span>
            <strong>{inlinePendingItem.toolName ?? inlinePendingItem.title}</strong>
            <em>{pendingSummaryLabel(inlinePendingItem.summary, language)}</em>
          </div>
        ) : null}
      </div>
      <div className="desktop-session-card__side">
        <span>{ageLabel(session.updatedAt)}</span>
        <button className="desktop-session-card__jump" type="button" disabled={jumpDisabled} onClick={(event) => { event.stopPropagation(); onJumpToTerminal?.(session) }}>{terminalJumpEnabled ? (language === 'zh-CN' ? '终端' : 'Terminal') : (language === 'zh-CN' ? '已禁用' : 'Disabled')}</button>
      </div>
    </article>
  )
}
