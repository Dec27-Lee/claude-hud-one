import type { MouseEventHandler, PointerEventHandler, Ref } from 'react'
import type { CurrentSessionState, IslandViewState } from '../../app/types'
import { ClawdMascot } from './ClawdMascot'
import { sessionActivityLabel, type ClawdMood, type DesktopHudLanguage } from './sessionFormatters'

type DesktopHudCapsuleProps = {
  buttonRef?: Ref<HTMLButtonElement>
  session: CurrentSessionState
  sessionsCount: number
  tickerText: string
  tickerCountText: string | null
  mood: ClawdMood
  viewState: IslandViewState
  language?: DesktopHudLanguage
  onClick: MouseEventHandler<HTMLButtonElement>
  onPointerDown: PointerEventHandler<HTMLButtonElement>
  onPointerMove: PointerEventHandler<HTMLButtonElement>
  onPointerUp: PointerEventHandler<HTMLButtonElement>
  onPointerCancel: PointerEventHandler<HTMLButtonElement>
  onPointerLeave: PointerEventHandler<HTMLButtonElement>
}

export function DesktopHudCapsule({
  buttonRef,
  session,
  sessionsCount,
  tickerText,
  tickerCountText,
  mood,
  viewState,
  language = 'en',
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: DesktopHudCapsuleProps) {
  const label = sessionsCount > 1 ? `Claude (${sessionsCount})` : 'Claude'
  const attention = session.activity === 'waiting' || session.activity === 'error'
  const toolLabel = session.activeToolName ? `$ ${session.activeToolName}` : session.modelLabel ?? 'Claude Code'

  return (
    <button
      ref={buttonRef}
      className={`desktop-hud-capsule desktop-hud-capsule--${viewState} desktop-hud-capsule--${session.activity}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      aria-label="Open Claude HUD One"
    >
      <span className="desktop-hud-capsule__wing desktop-hud-capsule__wing--left">
        <ClawdMascot mood={mood} activity={session.activity} />
        <span className="desktop-hud-capsule__tool">{toolLabel}</span>
      </span>

      <span className="desktop-hud-capsule__main">
        <span className="desktop-hud-capsule__title-row">
          <strong>{label}</strong>
          <span className={`desktop-hud-capsule__status desktop-hud-capsule__status--${session.activity}`}>{sessionActivityLabel(session.activity, language)}</span>
        </span>
        <span className="desktop-hud-capsule__ticker" aria-live="polite">
          <span key={tickerText} className="desktop-hud-capsule__ticker-line">{tickerText}</span>
        </span>
      </span>

      <span className="desktop-hud-capsule__wing desktop-hud-capsule__wing--right">
        {attention ? <span className="desktop-hud-capsule__bell" aria-hidden="true">!</span> : null}
        {tickerCountText ? <span className="desktop-hud-capsule__count">{tickerCountText}</span> : null}
        <span className="desktop-hud-capsule__terminal">↗</span>
      </span>
    </button>
  )
}
