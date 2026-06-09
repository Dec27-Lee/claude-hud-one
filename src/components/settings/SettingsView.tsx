import { useEffect, useState } from 'react'
import { checkForUpdates, getDiagnosticsSummary, getUpdateState, openAppDataDir, openReleasePage, type DiagnosticsSummary, type DisplayInfo, type UpdateState } from '../../app/overlayBridge'
import type { ChartStyle, CostStyle, IslandAppState, ProviderId, SettingsState, TokenCountMode } from '../../app/types'
import { displayedProviderOrder } from '../../app/types'

type SettingsViewProps = {
  state: IslandAppState
  displays: DisplayInfo[]
  onClose: () => void
  onOpenDiagnostics: () => void
  onPatchSettings: (settings: Partial<SettingsState>) => void
  onToggleProvider: (provider: ProviderId, visible: boolean) => void
  onSetChartStyle: (style: ChartStyle) => void
  onSetCostStyle: (style: CostStyle) => void
  onSetTokenCountMode: (mode: TokenCountMode) => void
  onRefreshNow: () => void
  isRefreshing: boolean
}

const chartStyles: ChartStyle[] = ['ring', 'bar', 'stepped', 'numeric', 'sparkline']
const costStyles: CostStyle[] = ['usd', 'value', 'tokens', 'trend']
const formatExists = (exists: boolean | undefined): string => exists ? 'yes' : 'no'

const toTargetDisplay = (value: string, displays: DisplayInfo[]): SettingsState['targetDisplay'] => {
  if (value === 'auto' || value === 'primary') return value
  const display = displays.find((item) => item.id === value)
  return { id: value, label: display?.name ?? value }
}

export function SettingsView({ state, displays, onClose, onOpenDiagnostics, onPatchSettings, onToggleProvider, onSetChartStyle, onSetCostStyle, onSetTokenCountMode, onRefreshNow, isRefreshing }: SettingsViewProps) {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    void getUpdateState().then((nextState) => {
      if (!cancelled) setUpdateState(nextState)
    })
    void getDiagnosticsSummary().then((nextSummary) => {
      if (!cancelled) setDiagnostics(nextSummary)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckForUpdates = async (): Promise<void> => {
    setUpdateState(await checkForUpdates())
  }

  const handleOpenAppData = async (): Promise<void> => {
    await openAppDataDir()
    setDiagnostics(await getDiagnosticsSummary())
  }

  const handleOpenReleasePage = async (): Promise<void> => {
    await openReleasePage()
  }

  return (
    <aside className="settings-window">
      <header>
        <div>
          <span className="section-kicker">Settings</span>
          <h2>Claude Island Win</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close settings">×</button>
      </header>

      <section className="settings-section">
        <h3>General</h3>
        <label><input type="checkbox" checked={state.settings.launchAtLogin} onChange={(event) => onPatchSettings({ launchAtLogin: event.currentTarget.checked })} /> Launch at Login</label>
        <label><input type="checkbox" checked={state.settings.alwaysShowUsage} onChange={(event) => onPatchSettings({ alwaysShowUsage: event.currentTarget.checked })} /> Always show usage</label>
        <label><input type="checkbox" checked={state.settings.lowPowerMode} onChange={(event) => onPatchSettings({ lowPowerMode: event.currentTarget.checked })} /> Low Power Mode</label>
        <label><input type="checkbox" checked={state.settings.fullscreenAvoidance} onChange={(event) => onPatchSettings({ fullscreenAvoidance: event.currentTarget.checked })} /> Hide on fullscreen apps</label>
        <div className="segmented-control">
          {[5, 15, 30].map((minutes) => (
            <button key={minutes} className={state.settings.refreshIntervalMinutes === minutes ? 'segmented-control__item segmented-control__item--active' : 'segmented-control__item'} onClick={() => onPatchSettings({ refreshIntervalMinutes: minutes as 5 | 15 | 30 })}>{minutes}m</button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Display</h3>
        <label>Language
          <select value={state.settings.language} onChange={(event) => onPatchSettings({ language: event.currentTarget.value as SettingsState['language'] })}>
            <option value="auto">Auto</option>
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </label>
        <div className="tile-picker">
          {(['compact', 'notch', 'custom'] as SettingsState['islandWidthMode'][]).map((mode) => <button key={mode} className={state.settings.islandWidthMode === mode ? 'style-tile style-tile--active' : 'style-tile'} onClick={() => onPatchSettings({ islandWidthMode: mode })}>{mode}</button>)}
        </div>
        <div className="tile-picker">
          {chartStyles.map((style) => <button key={style} className={state.settings.chartStyle === style ? 'style-tile style-tile--active' : 'style-tile'} onClick={() => onSetChartStyle(style)}>{style}</button>)}
        </div>
        <div className="tile-picker">
          {costStyles.map((style) => <button key={style} className={state.settings.costStyle === style ? 'style-tile style-tile--active' : 'style-tile'} onClick={() => onSetCostStyle(style)}>{style}</button>)}
        </div>
      </section>

      <section className="settings-section">
        <h3>Placement</h3>
        <label>Target display
          <select value={typeof state.settings.targetDisplay === 'string' ? state.settings.targetDisplay : state.settings.targetDisplay.id} onChange={(event) => onPatchSettings({ targetDisplay: toTargetDisplay(event.currentTarget.value, displays) })}>
            <option value="auto">Auto</option>
            <option value="primary">Primary display</option>
            {displays.map((display) => (
              <option value={display.id} key={display.id}>{display.name}{display.isPrimary ? ' · primary' : ''} · {display.workArea.width}×{display.workArea.height} @{display.scaleFactor}x</option>
            ))}
          </select>
        </label>
        <label>Top offset <strong>{state.settings.topOffsetPx}px</strong></label>
        <input type="range" min="0" max="120" value={state.settings.topOffsetPx} onChange={(event) => onPatchSettings({ topOffsetPx: Number(event.currentTarget.value) })} />
      </section>

      <section className="settings-section">
        <h3>Alerts</h3>
        <label><input type="checkbox" checked={state.settings.alertsEnabled} onChange={(event) => onPatchSettings({ alertsEnabled: event.currentTarget.checked })} /> Enable usage alerts</label>
        <label>Warning threshold <strong>{state.settings.warningThreshold}%</strong></label>
        <input type="range" min="40" max="95" value={state.settings.warningThreshold} onChange={(event) => onPatchSettings({ warningThreshold: Number(event.currentTarget.value) })} />
        <label>Critical threshold <strong>{state.settings.criticalThreshold}%</strong></label>
        <input type="range" min="60" max="100" value={state.settings.criticalThreshold} onChange={(event) => onPatchSettings({ criticalThreshold: Number(event.currentTarget.value) })} />
      </section>

      <section className="settings-section">
        <h3>Providers</h3>
        {displayedProviderOrder.map((providerId) => {
          const provider = state.providers[providerId]
          return <label key={providerId}><input type="checkbox" checked={provider.visible} onChange={(event) => onToggleProvider(providerId, event.currentTarget.checked)} /> {provider.name} · {provider.plan ?? 'No plan'} · {provider.lastUpdatedLabel}</label>
        })}
        <div className="segmented-control">
          {(['all', 'billable'] as TokenCountMode[]).map((mode) => (
            <button key={mode} className={state.settings.tokenCountMode === mode ? 'segmented-control__item segmented-control__item--active' : 'segmented-control__item'} onClick={() => onSetTokenCountMode(mode)}>{mode}</button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Updates</h3>
        <div className="diagnostics-grid">
          <span>Version</span><strong>{updateState?.currentVersion ?? '0.1.0'}</strong>
          <span>Channel</span><strong>{updateState?.channel ?? 'stable'}</strong>
          <span>Status</span><strong>{updateState?.status ?? 'not loaded'}</strong>
          <span>Configured</span><strong>{updateState?.configured ? 'yes' : 'no'}</strong>
          <span>Can check</span><strong>{updateState?.canCheck ? 'yes' : 'no'}</strong>
          <span>Last check</span><strong>{updateState?.lastCheckedAt ?? 'never'}</strong>
          <span>Endpoint</span><strong>{updateState?.endpoint ?? 'not configured'}</strong>
          <span>Manual update</span><strong>{updateState?.manualUpdateAvailable ? 'available' : 'not available'}</strong>
          <span>Release page</span><strong title={updateState?.releasePageUrl ?? undefined}>{updateState?.releasePageUrl ?? 'not configured'}</strong>
          <span>Error code</span><strong>{updateState?.errorCode ?? 'none'}</strong>
        </div>
        <p>{updateState?.message ?? 'Updater status is loading.'}</p>
        <div className="settings-actions">
          <button className="secondary-button" disabled={updateState?.canCheck === false} onClick={() => void handleCheckForUpdates()}>Check for updates</button>
          <button className="secondary-button" disabled={!updateState?.manualUpdateAvailable} onClick={() => void handleOpenReleasePage()}>Open release page</button>
        </div>
      </section>

      <section className="settings-section">
        <h3>About / Diagnostics</h3>
        <p>本地优先，无默认遥测。当前会话测试只统计事件类型、数量和时间戳，不展示 prompt、transcript 正文或 tool-result 正文。</p>
        <div className="diagnostics-grid">
          <span>Session source</span><strong>{state.currentSession.mode} · {state.currentSession.sourceLabel}</strong>
          <span>Project</span><strong>{state.currentSession.projectSlug}</strong>
          <span>Events</span><strong>{state.currentSession.totalEventCount.toLocaleString()} total · {state.currentSession.assistantEventCount.toLocaleString()} assistant · {state.currentSession.userEventCount.toLocaleString()} user</strong>
          <span>Tools</span><strong>{state.currentSession.toolCallRecordCount.toLocaleString()} records · {state.currentSession.toolResultFileCount.toLocaleString()} result files</strong>
          <span>Last activity</span><strong>{state.currentSession.lastEventLabel}</strong>
          <span>App data</span><strong title={diagnostics?.appDataDir ?? undefined}>{diagnostics?.appDataDir ?? 'not loaded'}</strong>
          <span>Settings file</span><strong title={diagnostics?.settingsPath ?? undefined}>{formatExists(diagnostics?.settingsExists)}</strong>
          <span>Usage cache</span><strong title={diagnostics?.usageCachePath ?? undefined}>{formatExists(diagnostics?.usageCacheExists)}</strong>
          <span>Claude projects</span><strong title={diagnostics?.claudeProjectsRoot ?? undefined}>{formatExists(diagnostics?.claudeProjectsRootExists)}</strong>
        </div>
        <p>{diagnostics?.privacyNote ?? 'Diagnostics summary is loading.'}</p>
        <div className="settings-actions">
          <button className="secondary-button" onClick={onRefreshNow} disabled={isRefreshing}>{isRefreshing ? 'Refreshing…' : 'Refresh now'}</button>
          <button className="secondary-button" onClick={onOpenDiagnostics}>Open Claude logs</button>
          <button className="secondary-button" onClick={() => void handleOpenAppData()}>Open app data</button>
        </div>
      </section>
    </aside>
  )
}
