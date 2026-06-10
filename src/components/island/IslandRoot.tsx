import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window'
import { setOverlayPosition, updateOverlayHitRegions, type OverlayHitRegion } from '../../app/overlayBridge'
import type { CurrentSessionState, IslandAppState, IslandPage, IslandViewState, OverlayPosition, ProviderId } from '../../app/types'
import { displayedProviderOrder } from '../../app/types'
import { CostView } from './CostView'
import { CurrentSessionStrip } from './CurrentSessionStrip'
import { OverviewView } from './OverviewView'
import { UsageView } from './UsageView'

type IslandRootProps = {
  state: IslandAppState
  onOpenSettings: () => void
  onToggleProvider: (provider: ProviderId, visible: boolean) => void
  onRefreshNow: () => void
  isRefreshing: boolean
  onOverlayPositionChange: (position: OverlayPosition) => void
}

type SessionActivity = IslandAppState['currentSession']['activity']

const pageLabels: Record<IslandPage, string> = {
  usage: 'Usage',
  cost: 'Cost',
  overview: 'Overview',
}

const pages: IslandPage[] = ['usage', 'cost', 'overview']
const LONG_PRESS_DRAG_MS = 420

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const sessionActivityLabels: Record<SessionActivity, string> = {
  idle: 'Idle',
  active: 'Active',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
}

const claudePetals = Array.from({ length: 6 }, (_, index) => index)

function ClaudeCodeMark({ activity }: { activity: SessionActivity }) {
  return (
    <span className={`capsule-logo capsule-logo--claude-code capsule-logo--${activity}`} aria-hidden="true">
      <span className="claude-code-mark">
        <span className="claude-code-mark__core" />
        {claudePetals.map((petal) => (
          <span key={petal} className="claude-code-mark__petal" style={{ '--petal-index': petal } as CSSProperties} />
        ))}
      </span>
    </span>
  )
}

function CodeCursorMark({ activity }: { activity: SessionActivity }) {
  return (
    <span className={`capsule-logo capsule-logo--code-cursor capsule-logo--${activity}`} aria-hidden="true">
      <span className="code-cursor-mark">
        <span className="code-cursor-mark__prompt">›</span>
        <span className="code-cursor-mark__cursor" />
      </span>
    </span>
  )
}

const pathBaseName = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? null
}

const compactLabel = (value: string, maxLength = 18): string => (
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
    return compactLabel(name, 18)
  }

  return `#${shortCode(session.sessionId ?? session.transcriptPath ?? session.sessionKey) ?? 'session'}`
}

const identityLabel = (session: CurrentSessionState): string => `${workspaceLabel(session)} / ${sessionLabel(session)}`

const sessionKey = (session: CurrentSessionState, index: number): string => (
  session.sessionKey ?? session.sessionId ?? session.transcriptPath ?? `${workspaceLabel(session)}-${index}`
)

const sessionStatusText = (session: CurrentSessionState): string => (
  session.activeToolName
    ? `Tool ${session.activeToolName}`
    : session.bridgeStatusText
      ?? session.modelLabel
      ?? session.lastEventLabel
      ?? session.sourceLabel
)

const sessionTickerText = (session: CurrentSessionState): string => {
  const activityLabel = sessionActivityLabels[session.activity]
  const status = sessionStatusText(session)
  return [activityLabel, identityLabel(session), status].filter(Boolean).join(' · ')
}

const sortedSessions = (sessions: CurrentSessionState[]): CurrentSessionState[] => {
  const rank: Record<SessionActivity, number> = { running: 0, waiting: 1, error: 2, active: 3, idle: 4 }
  return [...sessions].sort((left, right) => {
    const rankDiff = rank[left.activity] - rank[right.activity]
    if (rankDiff !== 0) return rankDiff
    return Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '')
  })
}

const browserPreviewViewState = (fallback: IslandViewState): IslandViewState => {
  const value = new URLSearchParams(window.location.search).get('view')
  return value === 'compact' || value === 'peek' || value === 'expanded' ? value : fallback
}

const browserPreviewPage = (): IslandPage => {
  const value = new URLSearchParams(window.location.search).get('page')
  return value === 'cost' || value === 'overview' || value === 'usage' ? value : 'usage'
}

const rectToHitRegion = (rect: DOMRect): OverlayHitRegion => {
  const scaleFactor = window.devicePixelRatio || 1
  return {
    x: Math.round(rect.left * scaleFactor),
    y: Math.round(rect.top * scaleFactor),
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  }
}

export function IslandRoot({ state, onOpenSettings, onToggleProvider, onRefreshNow, isRefreshing, onOverlayPositionChange }: IslandRootProps) {
  const capsuleRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragTimerRef = useRef<number | null>(null)
  const dragLoopRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const latestDragPositionRef = useRef<OverlayPosition | null>(null)
  const dragSessionRef = useRef(false)
  const dragMoveInFlightRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const defaultViewState = state.settings.alwaysShowUsage ? 'peek' : 'compact'
  const [viewState, setViewState] = useState<IslandViewState>(() => browserPreviewViewState(defaultViewState))
  const [activePage, setActivePage] = useState<IslandPage>(() => browserPreviewPage())
  const [tickerIndex, setTickerIndex] = useState(0)
  const providers = useMemo(() => displayedProviderOrder.map((provider) => state.providers[provider]), [state.providers])
  const sessions = useMemo(() => sortedSessions(state.sessions.length > 0 ? state.sessions : [state.currentSession]), [state.currentSession, state.sessions])
  const tickerSession = sessions[tickerIndex % sessions.length] ?? state.currentSession
  const tickerKey = sessionKey(tickerSession, tickerIndex % Math.max(sessions.length, 1))
  const alertClass = state.alerts.severity === 'none' ? '' : ` island-shell--${state.alerts.severity}`
  const powerClass = state.settings.lowPowerMode ? ' island-shell--low-power' : ''
  const sessionActivity = tickerSession.activity
  const sessionActivityLabel = sessionActivityLabels[sessionActivity]
  const shouldAutoPeek = viewState === 'compact' && (sessionActivity === 'running' || sessionActivity === 'waiting' || sessionActivity === 'error')
  const effectiveViewState = shouldAutoPeek ? 'peek' : viewState

  const openExpanded = (): void => setViewState('expanded')
  const restState = (): IslandViewState => (state.settings.alwaysShowUsage ? 'peek' : 'compact')

  const clearDragTimer = (): void => {
    if (dragTimerRef.current !== null) {
      window.clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
  }

  const clearDragLoop = (): void => {
    if (dragLoopRef.current !== null) {
      window.clearInterval(dragLoopRef.current)
      dragLoopRef.current = null
    }
  }

  const startLongPressDrag = async (): Promise<void> => {
    dragTimerRef.current = null
    if (!isTauriRuntime()) return

    try {
      const position = await getCurrentWindow().outerPosition()
      const anchor = dragStartRef.current ?? { x: window.innerWidth / 2, y: 23 }
      const scaleFactor = window.devicePixelRatio || 1

      dragAnchorRef.current = {
        x: Math.round(anchor.x * scaleFactor),
        y: Math.round(anchor.y * scaleFactor),
      }
      latestDragPositionRef.current = { x: Math.round(position.x), y: Math.round(position.y) }
      dragSessionRef.current = true
      suppressNextClickRef.current = true
      clearDragLoop()
      dragLoopRef.current = window.setInterval(() => void applyDragMove(), 16)
      void applyDragMove()
    } catch (error) {
      dragAnchorRef.current = null
      dragSessionRef.current = false
      suppressNextClickRef.current = false
      console.warn('Failed to start overlay drag', error)
    }
  }

  const applyDragMove = async (): Promise<void> => {
    if (!dragSessionRef.current || !dragAnchorRef.current || dragMoveInFlightRef.current) return

    dragMoveInFlightRef.current = true
    try {
      const cursor = await cursorPosition()
      const anchor = dragAnchorRef.current
      if (!anchor) return

      const nextPosition = {
        x: Math.round(cursor.x - anchor.x),
        y: Math.round(cursor.y - anchor.y),
      }
      latestDragPositionRef.current = nextPosition
      await setOverlayPosition(nextPosition)
    } catch (error) {
      console.warn('Failed to move overlay while dragging', error)
    } finally {
      dragMoveInFlightRef.current = false
    }
  }

  const handleCapsulePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    clearDragTimer()
    dragTimerRef.current = window.setTimeout(() => void startLongPressDrag(), LONG_PRESS_DRAG_MS)
  }

  const handleCapsulePointerMove = (): void => {
    if (dragSessionRef.current) {
      void applyDragMove()
    }
  }

  const finishDrag = (): void => {
    clearDragTimer()
    clearDragLoop()
    dragStartRef.current = null
    dragAnchorRef.current = null

    if (dragSessionRef.current && latestDragPositionRef.current) {
      onOverlayPositionChange(latestDragPositionRef.current)
    }

    dragSessionRef.current = false
  }

  const handleCapsulePointerEnd = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    finishDrag()
  }

  const handleCapsulePointerLeave = (): void => {
    if (!dragSessionRef.current) {
      clearDragTimer()
      dragStartRef.current = null
    }
  }

  const handleCapsuleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }

    openExpanded()
  }

  useEffect(() => () => {
    clearDragTimer()
    clearDragLoop()
  }, [])

  useEffect(() => {
    if (sessions.length <= 1) {
      setTickerIndex(0)
      return
    }

    const intervalId = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % sessions.length)
    }, state.settings.lowPowerMode ? 5_000 : 4_000)

    return () => window.clearInterval(intervalId)
  }, [sessions.length, state.settings.lowPowerMode])

  useEffect(() => {
    if (tickerIndex >= sessions.length) setTickerIndex(0)
  }, [sessions.length, tickerIndex])

  useLayoutEffect(() => {
    const observedElements = [capsuleRef.current, panelRef.current].filter((element): element is HTMLButtonElement | HTMLDivElement => Boolean(element))

    const updateRegions = (): void => {
      const regions = observedElements
        .map((element) => rectToHitRegion(element.getBoundingClientRect()))
        .filter((region) => region.width > 0 && region.height > 0)

      if (regions.length > 0) {
        void updateOverlayHitRegions(regions)
      }
    }

    updateRegions()

    const resizeObserver = new ResizeObserver(updateRegions)
    observedElements.forEach((element) => resizeObserver.observe(element))
    window.addEventListener('resize', updateRegions)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateRegions)
    }
  }, [activePage, effectiveViewState, sessions.length])

  return (
    <main className="desktop-stage">
      <section
        className={`island-shell island-shell--${effectiveViewState}${alertClass}${powerClass}`}
        onMouseEnter={() => setViewState((current) => (current === 'expanded' ? current : 'peek'))}
        onMouseLeave={() => setViewState((current) => (current === 'expanded' ? restState() : restState()))}
      >
        <button
          ref={capsuleRef}
          className="island-capsule"
          onClick={handleCapsuleClick}
          onPointerDown={handleCapsulePointerDown}
          onPointerMove={handleCapsulePointerMove}
          onPointerUp={handleCapsulePointerEnd}
          onPointerCancel={handleCapsulePointerEnd}
          onPointerLeave={handleCapsulePointerLeave}
          aria-label="Open Claude HUD One"
        >
          <ClaudeCodeMark activity={sessionActivity} />
          {effectiveViewState !== 'compact' ? (
            <span className="peek-metrics">
              <span className={`session-ticker session-peek session-peek--${sessionActivity}`} aria-live="polite">
                <span key={`${tickerKey}-${tickerIndex}`} className="session-ticker__line">
                  <span>{sessionTickerText(tickerSession)}</span>
                  {sessions.length > 1 ? <span className="session-ticker__count">{(tickerIndex % sessions.length) + 1}/{sessions.length}</span> : null}
                </span>
              </span>
            </span>
          ) : (
            <span className={`session-ticker session-ticker--compact session-peek--${sessionActivity}`} aria-live="polite">
              <span key={`${tickerKey}-${tickerIndex}`} className="session-ticker__line">
                <span>{sessionTickerText(tickerSession)}</span>
              </span>
            </span>
          )}
          <CodeCursorMark activity={sessionActivity} />
        </button>

        {viewState === 'expanded' ? (
          <div ref={panelRef} className="expanded-panel">
            <header className="panel-header">
              <div>
                <span className="section-kicker">Claude HUD One</span>
                <h1>{pageLabels[activePage]}</h1>
                {state.alerts.message ? <span className={`alert-banner alert-banner--${state.alerts.severity}`}>{state.alerts.message}</span> : null}
              </div>
              <div className="provider-switches">
                {providers.map((provider) => (
                  <button
                    className={provider.visible ? 'provider-chip provider-chip--active' : 'provider-chip'}
                    key={provider.id}
                    onClick={() => onToggleProvider(provider.id, !provider.visible)}
                    style={{ borderColor: provider.visible ? provider.accent : undefined }}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>
            </header>

            <CurrentSessionStrip session={tickerSession} sessions={sessions} />

            <div className="panel-body">
              {activePage === 'usage' ? <UsageView providers={providers} chartStyle={state.settings.chartStyle} warningThreshold={state.settings.warningThreshold} criticalThreshold={state.settings.criticalThreshold} /> : null}
              {activePage === 'cost' ? <CostView providers={providers} cost={state.cost} costStyle={state.settings.costStyle} tokenCountMode={state.settings.tokenCountMode} /> : null}
              {activePage === 'overview' ? <OverviewView buckets={state.dailyBuckets} showCodex={false} /> : null}
            </div>

            <footer className="panel-footer">
              <div className="panel-footer__actions">
                <button className="icon-button" onClick={onOpenSettings} aria-label="Open settings">⚙</button>
                <button className="icon-button" onClick={onRefreshNow} disabled={isRefreshing} aria-label="Refresh Claude HUD One data">{isRefreshing ? '…' : '↻'}</button>
              </div>
              <span>{isRefreshing ? 'Refreshing now…' : activePage === 'usage' ? state.lastUsageSyncLabel : state.lastCostSyncLabel}</span>
              <nav className="page-dots" aria-label="Island pages">
                {pages.map((page) => (
                  <button
                    key={page}
                    className={page === activePage ? 'page-dot page-dot--active' : 'page-dot'}
                    onClick={() => setActivePage(page)}
                    aria-label={pageLabels[page]}
                  />
                ))}
              </nav>
              <span className="style-chip">{state.settings.lowPowerMode ? 'low power' : activePage === 'usage' ? state.settings.chartStyle : activePage === 'cost' ? state.settings.costStyle : 'grid'}</span>
            </footer>
          </div>
        ) : null}
      </section>
    </main>
  )
}
