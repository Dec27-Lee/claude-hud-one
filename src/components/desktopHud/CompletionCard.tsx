import type { CurrentSessionState } from '../../app/types'
import { workspaceLabel, type DesktopHudLanguage } from './sessionFormatters'

type CompletionCardProps = {
  session: CurrentSessionState
  completedAt: string
  language?: DesktopHudLanguage
  onOpenTerminal?: (session: CurrentSessionState) => void
  onDismiss?: () => void
}

const completionTimeLabel = (iso: string, language: DesktopHudLanguage): string => {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return language === 'zh-CN' ? '刚刚' : 'just now'

  const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (ageSeconds < 10) return language === 'zh-CN' ? '刚刚' : 'just now'
  if (ageSeconds < 60) return language === 'zh-CN' ? `${ageSeconds} 秒前` : `${ageSeconds}s ago`
  return language === 'zh-CN' ? `${Math.round(ageSeconds / 60)} 分钟前` : `${Math.round(ageSeconds / 60)}m ago`
}

export function CompletionCard({ session, completedAt, language = 'en', onOpenTerminal, onDismiss }: CompletionCardProps) {
  const terminalAvailable = Boolean(session.terminal?.cwd ?? session.projectDir)
  const copy = language === 'zh-CN'
    ? {
        aria: 'Claude Code 完成卡片',
        kicker: '已完成',
        title: `${workspaceLabel(session)} 已完成一轮 Claude Code 任务`,
        hint: `${completionTimeLabel(completedAt, language)} · 如需详情，请查看终端。`,
        openTerminal: '打开终端',
        dismiss: '关闭',
      }
    : {
        aria: 'Claude Code completion card',
        kicker: 'Completed',
        title: `${workspaceLabel(session)} finished a Claude Code turn`,
        hint: `${completionTimeLabel(completedAt, language)} · Review the terminal if you need details.`,
        openTerminal: 'Open terminal',
        dismiss: 'Dismiss',
      }

  return (
    <article className="desktop-completion-card" aria-label={copy.aria}>
      <div className="desktop-completion-card__badge">✓</div>
      <div className="desktop-completion-card__body">
        <span className="section-kicker">{copy.kicker}</span>
        <strong>{copy.title}</strong>
        <p>{copy.hint}</p>
      </div>
      <div className="desktop-completion-card__actions">
        <button type="button" disabled={!terminalAvailable || !onOpenTerminal} onClick={() => onOpenTerminal?.(session)}>{copy.openTerminal}</button>
        <button type="button" onClick={onDismiss}>{copy.dismiss}</button>
      </div>
    </article>
  )
}
