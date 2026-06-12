import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { cursorPosition, getCurrentWindow } from '@tauri-apps/api/window'
import { jumpToClaudeSessionTerminal, setOverlayPosition, updateOverlayHitRegions, updateOverlayLayout, type OverlayHitRegion } from '../../app/overlayBridge'
import type { CurrentSessionState, IslandAppState, IslandViewState, OverlayPosition, PendingQueueItem, ProviderId, SessionActivityState } from '../../app/types'
import type { HudDisplayItemId } from '../../hud/types'
import { CompletionCard } from './CompletionCard'
import { DesktopHudCapsule } from './DesktopHudCapsule'
import { PendingQueueSurface, type PendingQueueSurfaceItem } from './PendingQueueSurface'
import { SessionCard } from './SessionCard'
import { moodForActivity, resolveDesktopHudLanguage, sessionKey, sessionTickerText, sortedSessions, type DesktopHudLanguage } from './sessionFormatters'

type DesktopHudRootProps = {
  state: IslandAppState
  onOpenSettings: () => void
  onToggleProvider: (provider: ProviderId, visible: boolean) => void
  onRefreshNow: () => void
  isRefreshing: boolean
  onOverlayPositionChange: (position: OverlayPosition) => void
}

type CodeIslandSurface = 'collapsed' | 'sessionList' | 'approvalCard' | 'questionCard' | 'completionCard'
type SessionGroupingMode = 'all' | 'status' | 'cli'
type SessionPanelEntry = { session: CurrentSessionState; index: number }

const SESSION_GROUPING_OPTIONS: { value: SessionGroupingMode; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'status', label: 'STA' },
  { value: 'cli', label: 'CLI' },
]

const STATUS_GROUP_LABELS: Record<DesktopHudLanguage, Record<SessionActivityState, string>> = {
  en: {
    waiting: 'Waiting',
    running: 'Running',
    error: 'Error',
    active: 'Active',
    idle: 'Idle',
  },
  'zh-CN': {
    waiting: '等待中',
    running: '运行中',
    error: '异常',
    active: '活跃',
    idle: '空闲',
  },
}

const LONG_PRESS_DRAG_MS = 420
const COMPLETION_CARD_TTL_MS = 90_000

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const browserPreviewViewState = (fallback: IslandViewState): IslandViewState => {
  const value = new URLSearchParams(window.location.search).get('view')
  return value === 'compact' || value === 'peek' || value === 'expanded' ? value : fallback
}

const rectToHitRegion = (rect: DOMRect): OverlayHitRegion => ({
  x: Math.round(rect.left),
  y: Math.round(rect.top),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
})

const pendingTimestamp = (item: PendingQueueItem): number => {
  const timestamp = Date.parse(item.updatedAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const pendingItemDisplayKey = (item: PendingQueueItem, session: CurrentSessionState, sessionIndex: number): string => {
  const sessionPart = item.sessionId ?? session.sessionId ?? session.sessionKey ?? session.projectDir ?? session.projectSlug ?? `session-${sessionIndex}`
  return `${sessionPart}:${item.id}`
}

const isBusyActivity = (activity: SessionActivityState): boolean => activity === 'running' || activity === 'waiting'
const isSettledActivity = (activity: SessionActivityState): boolean => activity === 'active' || activity === 'idle'

const freshIsoWithin = (iso: string | null | undefined, now: number, ttlMs: number): string | null => {
  if (!iso) return null
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return null
  return now - timestamp <= ttlMs ? iso : null
}

const terminalJumpMessage = (message: string | null | undefined, language: DesktopHudLanguage): string => {
  if (!message) return language === 'zh-CN' ? '浏览器预览中无法跳转终端。' : 'Terminal jump is unavailable in browser preview.'
  if (language !== 'zh-CN') return message
  if (/program not found/i.test(message)) return '未找到 Windows Terminal（wt.exe）。请安装 Windows Terminal，或把 wt.exe 加入 PATH。'
  if (/No working directory/i.test(message)) return '没有采集到这个 Claude Code 会话的工作目录。'
  if (/unsupported/i.test(message)) return '当前平台暂不支持终端跳转。'
  if (/Focused the existing Windows Terminal/i.test(message)) return '已切换到这个 Claude Code 会话所在的 Windows Terminal。'
  if (/Opened Windows Terminal at (.+)$/i.test(message)) return `已在 ${message.replace(/^Opened Windows Terminal at /i, '')} 打开 Windows Terminal。`
  return message
}

export function DesktopHudRoot({ state, onOpenSettings, onRefreshNow, isRefreshing, onOverlayPositionChange }: DesktopHudRootProps) {
  const shellRef = useRef<HTMLElement | null>(null)
  const capsuleRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const dragTimerRef = useRef<number | null>(null)
  const dragLoopRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const latestDragPositionRef = useRef<OverlayPosition | null>(null)
  const dragSessionRef = useRef(false)
  const dragMoveInFlightRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const previousActivityByKeyRef = useRef<Record<string, SessionActivityState>>({})
  const defaultViewState = state.settings.alwaysShowUsage ? 'peek' : 'compact'
  const desktopLanguage = resolveDesktopHudLanguage(state.settings.language)
  const desktopHud = state.settings.desktopHud
  const isDesktopItemVisible = (item: HudDisplayItemId): boolean => desktopHud.enabled && desktopHud.visibleItems[item] !== false
  const [viewState, setViewState] = useState<IslandViewState>(() => browserPreviewViewState(defaultViewState))
  const [sessionGroupingMode, setSessionGroupingMode] = useState<SessionGroupingMode>('all')
  const [tickerIndex, setTickerIndex] = useState(0)
  const [terminalJumpStatusByKey, setTerminalJumpStatusByKey] = useState<Record<string, string | null>>({})
  const [pendingActionStatusByKey, setPendingActionStatusByKey] = useState<Record<string, string | null>>({})
  const [dismissedPendingItemKeys, setDismissedPendingItemKeys] = useState<Record<string, boolean>>({})
  const [completionCardsByKey, setCompletionCardsByKey] = useState<Record<string, string>>({})
  const [dismissedCompletionKeys, setDismissedCompletionKeys] = useState<Record<string, boolean>>({})
  const [completionNow, setCompletionNow] = useState(() => Date.now())
  const sessions = useMemo(() => sortedSessions(state.sessions.length > 0 ? state.sessions : [state.currentSession]), [state.currentSession, state.sessions])
  const tickerSession = sessions[tickerIndex % sessions.length] ?? state.currentSession
  const tickerKey = sessionKey(tickerSession, tickerIndex % Math.max(sessions.length, 1))
  const completionCards = useMemo(() => sessions
    .map((session, index) => {
      const key = sessionKey(session, index)
      const transitionTimestamp = completionCardsByKey[key]
      const metadataTimestamp = isSettledActivity(session.activity) ? freshIsoWithin(session.lastAssistantResponseAt ?? session.updatedAt, completionNow, COMPLETION_CARD_TTL_MS) : null
      const completedAt = freshIsoWithin(transitionTimestamp, completionNow, COMPLETION_CARD_TTL_MS) ?? metadataTimestamp
      return completedAt && !dismissedCompletionKeys[key] ? { key, session, completedAt } : null
    })
    .filter((item): item is { key: string; session: CurrentSessionState; completedAt: string } => Boolean(item))
    .slice(0, 2), [completionCardsByKey, completionNow, dismissedCompletionKeys, sessions])
  const completionSessionKeys = useMemo(() => new Set(completionCards.map((item) => item.key)), [completionCards])
  const alertClass = state.alerts.severity === 'none' ? '' : ` desktop-hud--${state.alerts.severity}`
  const powerClass = state.settings.lowPowerMode ? ' desktop-hud--low-power' : ''
  const sessionActivity = tickerSession.activity
  const mood = moodForActivity(sessionActivity)
  const pendingItems = useMemo<PendingQueueSurfaceItem[]>(() => {
    const itemsByKey = new Map<string, PendingQueueSurfaceItem>()
    sessions.forEach((session, sessionIndex) => {
      for (const item of session.pendingQueue?.items ?? []) {
        if (item.status !== 'pending') continue
        const displayKey = pendingItemDisplayKey(item, session, sessionIndex)
        if (dismissedPendingItemKeys[displayKey]) continue
        itemsByKey.set(displayKey, { ...item, displayKey, sourceSession: session })
      }
    })
    return Array.from(itemsByKey.values()).sort((left, right) => pendingTimestamp(right) - pendingTimestamp(left))
  }, [dismissedPendingItemKeys, sessions])
  const activeApprovalItem = pendingItems.find((item) => item.kind === 'approval') ?? null
  const activeQuestionItem = pendingItems.find((item) => item.kind === 'question') ?? null
  const activePendingItem = activeApprovalItem ?? activeQuestionItem
  const activePendingQueuePosition = activePendingItem ? pendingItems.findIndex((item) => item.displayKey === activePendingItem.displayKey) + 1 : 1
  const autoPeekActivity = desktopHud.autoExpandOnWaiting && (sessionActivity === 'running' || sessionActivity === 'waiting' || sessionActivity === 'error')
  const autoPeekCompletion = desktopHud.autoExpandOnCompletion && completionCards.length > 0
  const autoPeekAttention = pendingItems.length > 0
  const shouldAutoPeek = viewState === 'compact' && (autoPeekActivity || autoPeekCompletion || autoPeekAttention)
  const effectiveViewState = shouldAutoPeek ? 'peek' : viewState
  const activeSurface: CodeIslandSurface = activeApprovalItem
    ? 'approvalCard'
    : activeQuestionItem
      ? 'questionCard'
      : completionCards.length > 0 && effectiveViewState !== 'compact'
        ? 'completionCard'
        : effectiveViewState !== 'compact'
          ? 'sessionList'
          : 'collapsed'
  const panelItems = desktopHud.zones?.panel?.length ? desktopHud.zones.panel : desktopHud.panelItems
  const tickerItems = desktopHud.zones?.ticker?.length ? desktopHud.zones.ticker : desktopHud.tickerItems
  const maxVisibleSessions = Math.max(1, desktopHud.maxVisibleSessions ?? 6)
  const focusSessions = desktopHud.smartSuppress && effectiveViewState !== 'expanded'
    ? sessions.filter((session, index) => isBusyActivity(session.activity) || session.activity === 'error' || completionSessionKeys.has(sessionKey(session, index)))
    : sessions
  const visibleSessions = focusSessions.length > 0 ? focusSessions : [tickerSession]
  const visibleSessionEntries = visibleSessions.map((session, index) => {
    const sourceIndex = sessions.indexOf(session)
    return { session, index: sourceIndex >= 0 ? sourceIndex : index }
  })
  const panelSessionEntries = effectiveViewState === 'expanded'
    ? visibleSessionEntries
    : visibleSessionEntries.slice(0, Math.min(3, maxVisibleSessions))
  const sessionGroups = (() => {
    if (sessionGroupingMode === 'all') return [{ key: 'all', label: null as string | null, entries: panelSessionEntries }]

    const groups = new Map<string, { key: string; label: string; entries: SessionPanelEntry[] }>()
    const ensureGroup = (key: string, label: string) => {
      const existing = groups.get(key)
      if (existing) return existing
      const next = { key, label, entries: [] }
      groups.set(key, next)
      return next
    }

    panelSessionEntries.forEach((entry) => {
      if (sessionGroupingMode === 'status') {
        ensureGroup(entry.session.activity, STATUS_GROUP_LABELS[desktopLanguage][entry.session.activity]).entries.push(entry)
        return
      }

      const source = entry.session.sourceLabel ?? 'Claude Code'
      ensureGroup(source, source).entries.push(entry)
    })

    return Array.from(groups.values())
  })()
  const sessionListStyle = { '--desktop-session-list-max-height': `${Math.max(1, maxVisibleSessions) * 82}px` } as CSSProperties

  const updateHitRegions = useCallback((): void => {
    const elements = [capsuleRef.current, panelRef.current].filter((element): element is HTMLButtonElement | HTMLDivElement => Boolean(element))
    const regions = elements
      .map((element) => rectToHitRegion(element.getBoundingClientRect()))
      .filter((region) => region.width > 0 && region.height > 0)
    const contentBounds = shellRef.current ? rectToHitRegion(shellRef.current.getBoundingClientRect()) : null

    if (contentBounds && contentBounds.width > 0 && contentBounds.height > 0) {
      void updateOverlayLayout(contentBounds, regions)
      return
    }

    void updateOverlayHitRegions(regions)
  }, [])

  const handleJumpToTerminal = useCallback(async (session: CurrentSessionState): Promise<void> => {
    const key = sessionKey(session, 0)
    setTerminalJumpStatusByKey((current) => ({ ...current, [key]: desktopLanguage === 'zh-CN' ? '正在打开 Windows Terminal…' : 'Opening Windows Terminal…' }))
    const result = await jumpToClaudeSessionTerminal(session)
    setTerminalJumpStatusByKey((current) => ({
      ...current,
      [key]: terminalJumpMessage(result?.message, desktopLanguage),
    }))
  }, [desktopLanguage])

  const handleOpenPendingTerminal = useCallback(async (item: PendingQueueSurfaceItem): Promise<void> => {
    const session = item.sourceSession
    if (!session) {
      setPendingActionStatusByKey((current) => ({ ...current, [item.displayKey]: desktopLanguage === 'zh-CN' ? '没有关联的 Claude Code 会话。' : 'No linked Claude Code session.' }))
      return
    }

    setPendingActionStatusByKey((current) => ({ ...current, [item.displayKey]: desktopLanguage === 'zh-CN' ? '正在打开 Windows Terminal…' : 'Opening Windows Terminal…' }))
    const result = await jumpToClaudeSessionTerminal(session)
    setPendingActionStatusByKey((current) => ({
      ...current,
      [item.displayKey]: terminalJumpMessage(result?.message, desktopLanguage),
    }))
  }, [desktopLanguage])

  const handleDismissPendingItem = useCallback((item: PendingQueueSurfaceItem): void => {
    setDismissedPendingItemKeys((current) => ({ ...current, [item.displayKey]: true }))
    setPendingActionStatusByKey((current) => ({ ...current, [item.displayKey]: null }))
  }, [])

  const handleShowAllSessions = useCallback((): void => {
    setDismissedCompletionKeys((current) => {
      const next = { ...current }
      completionCards.forEach((item) => { next[item.key] = true })
      return next
    })
    setViewState('expanded')
  }, [completionCards])

  const openExpanded = (): void => setViewState('expanded')
  const restState = (): IslandViewState => (state.settings.alwaysShowUsage ? 'peek' : 'compact')

  const clearHoverTimer = (): void => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const scheduleViewState = (nextState: IslandViewState, delayMs: number): void => {
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      setViewState((current) => (current === 'expanded' && nextState === 'peek' ? current : nextState))
    }, Math.max(0, delayMs))
  }

  const handleHudMouseEnter = (): void => {
    scheduleViewState('peek', desktopHud.hoverDelayMs ?? 500)
  }

  const handleHudMouseLeave = (): void => {
    scheduleViewState(restState(), desktopHud.collapseDelayMs ?? 150)
  }

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
      window.requestAnimationFrame(updateHitRegions)
    } catch (error) {
      console.warn('Failed to move overlay while dragging', error)
    } finally {
      dragMoveInFlightRef.current = false
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
    window.requestAnimationFrame(updateHitRegions)
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
    clearHoverTimer()
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

  useEffect(() => {
    let detectedCompletion = false
    const completedAt = new Date().toISOString()
    const nextActivityByKey: Record<string, SessionActivityState> = {}
    const completedKeys: string[] = []

    sessions.forEach((session, index) => {
      const key = sessionKey(session, index)
      const previousActivity = previousActivityByKeyRef.current[key]
      nextActivityByKey[key] = session.activity
      if (previousActivity && isBusyActivity(previousActivity) && isSettledActivity(session.activity)) {
        detectedCompletion = true
        completedKeys.push(key)
      }
    })

    previousActivityByKeyRef.current = nextActivityByKey
    if (!detectedCompletion) return

    setCompletionCardsByKey((current) => {
      const next = { ...current }
      completedKeys.forEach((key) => { next[key] = completedAt })
      return next
    })
    setCompletionNow(Date.now())
  }, [sessions])

  useEffect(() => {
    if (Object.keys(completionCardsByKey).length === 0) return undefined
    const intervalId = window.setInterval(() => setCompletionNow(Date.now()), 5_000)
    return () => window.clearInterval(intervalId)
  }, [completionCardsByKey])

  useLayoutEffect(() => {
    const observedElements = [shellRef.current, capsuleRef.current, panelRef.current]
      .filter((element): element is HTMLElement => Boolean(element))
    const shellElement = shellRef.current

    updateHitRegions()
    const animationFrameId = window.requestAnimationFrame(updateHitRegions)
    const calibrationIntervalId = window.setInterval(updateHitRegions, 1_000)
    const resizeObserver = new ResizeObserver(updateHitRegions)
    observedElements.forEach((element) => resizeObserver.observe(element))
    shellElement?.addEventListener('transitionend', updateHitRegions)
    window.addEventListener('resize', updateHitRegions)
    window.visualViewport?.addEventListener('resize', updateHitRegions)
    window.visualViewport?.addEventListener('scroll', updateHitRegions)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.clearInterval(calibrationIntervalId)
      resizeObserver.disconnect()
      shellElement?.removeEventListener('transitionend', updateHitRegions)
      window.removeEventListener('resize', updateHitRegions)
      window.visualViewport?.removeEventListener('resize', updateHitRegions)
      window.visualViewport?.removeEventListener('scroll', updateHitRegions)
    }
  }, [activeSurface, desktopHud.enabled, effectiveViewState, pendingItems.length, sessions.length, tickerKey, updateHitRegions])

  useEffect(() => {
    if (!desktopHud.enabled) void updateOverlayHitRegions([])
  }, [desktopHud.enabled])

  if (!desktopHud.enabled) return <main className="desktop-stage" aria-hidden="true" />

  return (
    <main className="desktop-stage desktop-hud-stage">
      <section
        ref={shellRef}
        className={`desktop-hud desktop-hud--${effectiveViewState} desktop-hud--${mood}${alertClass}${powerClass}`}
        onMouseEnter={handleHudMouseEnter}
        onMouseLeave={handleHudMouseLeave}
      >
        <DesktopHudCapsule
          buttonRef={capsuleRef}
          session={tickerSession}
          sessionsCount={sessions.length}
          tickerText={sessionTickerText(tickerSession, isDesktopItemVisible, tickerItems, desktopLanguage)}
          tickerCountText={sessions.length > 1 ? `${(tickerIndex % sessions.length) + 1}/${sessions.length}` : null}
          mood={mood}
          viewState={effectiveViewState}
          language={desktopLanguage}
          onClick={handleCapsuleClick}
          onPointerDown={handleCapsulePointerDown}
          onPointerMove={handleCapsulePointerMove}
          onPointerUp={handleCapsulePointerEnd}
          onPointerCancel={handleCapsulePointerEnd}
          onPointerLeave={handleCapsulePointerLeave}
        />

        {activeSurface !== 'collapsed' ? (
          <div ref={panelRef} className={`desktop-hud-panel desktop-hud-panel--${activeSurface}`} aria-label={desktopLanguage === 'zh-CN' ? 'CodeIsland 风格面板' : 'CodeIsland surface'}>
            <div className="desktop-hud-panel__divider" aria-hidden="true" />

            {activeSurface === 'approvalCard' && activeApprovalItem ? (
              <PendingQueueSurface
                items={[activeApprovalItem]}
                actionStatusByKey={pendingActionStatusByKey}
                queuePosition={activePendingQueuePosition}
                queueTotal={pendingItems.length}
                language={desktopLanguage}
                onOpenTerminal={handleOpenPendingTerminal}
                onDismiss={handleDismissPendingItem}
              />
            ) : null}

            {activeSurface === 'questionCard' && activeQuestionItem ? (
              <PendingQueueSurface
                items={[activeQuestionItem]}
                actionStatusByKey={pendingActionStatusByKey}
                queuePosition={activePendingQueuePosition}
                queueTotal={pendingItems.length}
                language={desktopLanguage}
                onOpenTerminal={handleOpenPendingTerminal}
                onDismiss={handleDismissPendingItem}
              />
            ) : null}

            {activeSurface === 'completionCard' ? (
              <div className="desktop-completion-list" aria-label="Recently completed Claude Code sessions">
                {completionCards.map((item) => (
                  <CompletionCard
                    key={item.key}
                    session={item.session}
                    completedAt={item.completedAt}
                    language={desktopLanguage}
                    onOpenTerminal={handleJumpToTerminal}
                    onDismiss={() => setDismissedCompletionKeys((current) => ({ ...current, [item.key]: true }))}
                  />
                ))}
                {sessions.length > 1 ? (
                  <button className="desktop-sessions-expand-link" type="button" onClick={handleShowAllSessions}>
                    {desktopLanguage === 'zh-CN' ? `显示全部 ${sessions.length} 个会话` : `Show all ${sessions.length} sessions`}
                  </button>
                ) : null}
              </div>
            ) : null}

            {activeSurface === 'sessionList' ? (
              <>
                <div className="desktop-hud-panel__toolbar">
                  <span>{desktopLanguage === 'zh-CN' ? `${sessions.length} 个会话` : (sessions.length > 1 ? `${sessions.length} sessions` : '1 session')}</span>
                  <div className="desktop-hud-panel__grouping" aria-label={desktopLanguage === 'zh-CN' ? '会话分组模式' : 'Session grouping mode'}>
                    {SESSION_GROUPING_OPTIONS.map((option) => (
                      <button
                        type="button"
                        className={sessionGroupingMode === option.value ? 'desktop-hud-panel__grouping-button desktop-hud-panel__grouping-button--active' : 'desktop-hud-panel__grouping-button'}
                        onClick={() => setSessionGroupingMode(option.value)}
                        key={option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="desktop-hud-panel__actions">
                    <button type="button" onClick={onOpenSettings} aria-label={desktopLanguage === 'zh-CN' ? '打开设置' : 'Open settings'}>⚙</button>
                    <button type="button" onClick={onRefreshNow} disabled={isRefreshing} aria-label={desktopLanguage === 'zh-CN' ? '刷新 Claude HUD One 数据' : 'Refresh Claude HUD One data'}>{isRefreshing ? '…' : '↻'}</button>
                  </div>
                </div>
                <div
                  className={`desktop-hud-session-list${effectiveViewState === 'expanded' ? ' desktop-hud-session-list--scroll' : ''}`}
                  style={sessionListStyle}
                  aria-label={desktopLanguage === 'zh-CN' ? '所有已监控的 Claude Code 会话' : 'All monitored Claude Code sessions'}
                >
                  {sessionGroups.map((group) => (
                    <div className="desktop-session-group" key={group.key}>
                      {group.label ? <div className="desktop-session-group__label">{group.label}</div> : null}
                      {group.entries.map(({ session, index }) => (
                        <SessionCard
                          key={sessionKey(session, index)}
                          session={session}
                          active={sessionKey(session, index) === sessionKey(tickerSession, tickerIndex)}
                          visibleItems={desktopHud.visibleItems}
                          panelItems={panelItems}
                          terminalJumpEnabled={desktopHud.terminalJumpBehavior !== 'disabled'}
                          terminalJumpStatus={terminalJumpStatusByKey[sessionKey(session, 0)]}
                          language={desktopLanguage}
                          onJumpToTerminal={handleJumpToTerminal}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
