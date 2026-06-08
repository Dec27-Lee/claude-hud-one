import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { updateOverlayHitRegions, type OverlayHitRegion } from '../../app/overlayBridge'
import type { IslandAppState, IslandPage, IslandViewState, ProviderId } from '../../app/types'
import { providerOrder } from '../../app/types'
import { CostView } from './CostView'
import { CurrentSessionStrip } from './CurrentSessionStrip'
import { OverviewView } from './OverviewView'
import { UsageView } from './UsageView'

type IslandRootProps = {
  state: IslandAppState
  onOpenSettings: () => void
  onToggleProvider: (provider: ProviderId, visible: boolean) => void
}

const pageLabels: Record<IslandPage, string> = {
  usage: 'Usage',
  cost: 'Cost',
  overview: 'Overview',
}

const pages: IslandPage[] = ['usage', 'cost', 'overview']

const usagePercent = (value: number): string => `${Math.round(value * 100)}%`
const sessionActivityLabels: Record<IslandAppState['currentSession']['activity'], string> = {
  idle: 'Idle',
  active: 'Active',
  running: 'Running',
  waiting: 'Waiting',
  error: 'Error',
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

export function IslandRoot({ state, onOpenSettings, onToggleProvider }: IslandRootProps) {
  const capsuleRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const defaultViewState = state.settings.alwaysShowUsage ? 'peek' : 'compact'
  const [viewState, setViewState] = useState<IslandViewState>(() => browserPreviewViewState(defaultViewState))
  const [activePage, setActivePage] = useState<IslandPage>(() => browserPreviewPage())
  const providers = useMemo(() => providerOrder.map((provider) => state.providers[provider]), [state.providers])
  const visibleProviders = providers.filter((provider) => provider.visible)
  const alertClass = state.alerts.severity === 'none' ? '' : ` island-shell--${state.alerts.severity}`
  const powerClass = state.settings.lowPowerMode ? ' island-shell--low-power' : ''
  const sessionActivity = state.currentSession.activity
  const sessionActivityLabel = sessionActivityLabels[sessionActivity]
  const sessionStatusLabel = state.currentSession.bridgeStatusText ?? sessionActivityLabel

  const openExpanded = (): void => setViewState('expanded')
  const restState = (): IslandViewState => (state.settings.alwaysShowUsage ? 'peek' : 'compact')

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
  }, [activePage, viewState, visibleProviders.length])

  return (
    <main className="desktop-stage">
      <section
        className={`island-shell island-shell--${viewState}${alertClass}${powerClass}`}
        onMouseEnter={() => setViewState((current) => (current === 'expanded' ? current : 'peek'))}
        onMouseLeave={() => setViewState((current) => (current === 'expanded' ? restState() : restState()))}
      >
        <button ref={capsuleRef} className="island-capsule" onClick={openExpanded} aria-label="Open Claude Island">
          <span className="capsule-logo capsule-logo--claude">C</span>
          {viewState !== 'compact' ? (
            <span className="peek-metrics">
              <span className={`session-peek session-peek--${sessionActivity}`}>
                Claude Code {sessionActivityLabel} · {sessionStatusLabel}
              </span>
              {visibleProviders.map((provider) => (
                <span key={provider.id} style={{ color: provider.accent }}>
                  {provider.name} {usagePercent(provider.fiveHour.usedPercent)} · {provider.fiveHour.resetAtLabel}
                </span>
              ))}
            </span>
          ) : <span className={`live-dot live-dot--${sessionActivity}`} title={`Claude Code ${sessionActivityLabel} · ${sessionStatusLabel}`} />}
          <span className="capsule-logo capsule-logo--codex">X</span>
        </button>

        {viewState === 'expanded' ? (
          <div ref={panelRef} className="expanded-panel">
            <header className="panel-header">
              <div>
                <span className="section-kicker">Claude Island Win</span>
                <h1>{pageLabels[activePage]}</h1>
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

            <CurrentSessionStrip session={state.currentSession} />

            <div className="panel-body">
              {activePage === 'usage' ? <UsageView providers={providers} chartStyle={state.settings.chartStyle} warningThreshold={state.settings.warningThreshold} criticalThreshold={state.settings.criticalThreshold} /> : null}
              {activePage === 'cost' ? <CostView providers={providers} cost={state.cost} costStyle={state.settings.costStyle} tokenCountMode={state.settings.tokenCountMode} /> : null}
              {activePage === 'overview' ? <OverviewView buckets={state.dailyBuckets} /> : null}
            </div>

            <footer className="panel-footer">
              <button className="icon-button" onClick={onOpenSettings} aria-label="Open settings">⚙</button>
              <span>{activePage === 'usage' ? state.lastUsageSyncLabel : state.lastCostSyncLabel}</span>
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
