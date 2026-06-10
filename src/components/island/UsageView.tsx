import type { ChartStyle, ProviderState } from '../../app/types'
import { UsageChart } from '../charts/UsageChart'

type UsageViewProps = {
  providers: ProviderState[]
  chartStyle: ChartStyle
  warningThreshold: number
  criticalThreshold: number
}

const sourceLabels: Record<NonNullable<ProviderState['source']>, string> = {
  mock: 'Mock preview',
  localEstimate: 'Local estimate',
  claudeCode: 'Claude Code estimate',
  endpoint: 'Official endpoint',
  cache: 'Last-known cache',
}

const authLabels: Record<NonNullable<ProviderState['authStatus']>, string> = {
  unknown: 'Auth unknown',
  missing: 'Auth missing',
  ok: 'Auth OK',
  expired: 'Auth expired',
  scopeRequired: 'Scope required',
  notConfigured: 'Auth not configured',
}

const resetText = (label: '5h' | '7d', resetAtLabel: string): string => {
  if (resetAtLabel === 'rate limits unavailable') return `${label} rate limits unavailable`
  return `${label} resets in ${resetAtLabel}`
}

const usageStatus = (provider: ProviderState, warningThreshold: number, criticalThreshold: number): 'live' | 'warning' | 'critical' | 'stale' | 'error' => {
  if (provider.fiveHour.error || provider.weekly.error) return 'error'
  if (provider.stale) return 'stale'
  const percent = Math.max(provider.fiveHour.usedPercent, provider.weekly.usedPercent) * 100
  if (percent >= criticalThreshold) return 'critical'
  if (percent >= warningThreshold) return 'warning'
  return 'live'
}

export function UsageView({ providers, chartStyle, warningThreshold, criticalThreshold }: UsageViewProps) {
  const visibleProviders = providers.filter((provider) => provider.visible)

  if (visibleProviders.length === 0) {
    return <div className="empty-state">Claude 已隐藏。可在 Providers 设置里重新开启。</div>
  }

  return (
    <div className={visibleProviders.length === 1 ? 'usage-grid usage-grid--single' : 'usage-grid'}>
      {visibleProviders.map((provider) => {
        const status = usageStatus(provider, warningThreshold, criticalThreshold)
        const sourceLabel = sourceLabels[provider.source ?? 'mock']
        const authLabel = authLabels[provider.authStatus ?? 'unknown']
        return (
          <article className={`provider-card provider-card--${status}`} key={provider.id}>
            <div className="provider-card__header">
              <div>
                <span className="section-kicker">{provider.name}</span>
                <h3>{provider.plan ?? 'No plan'}</h3>
              </div>
              <div className="provider-status-stack">
                <span className={`status-pill status-pill--${status}`}>{status}</span>
                <span className="provider-dot" style={{ background: provider.accent }} />
              </div>
            </div>
            <div className="usage-window-grid">
              <div className="usage-window">
                {provider.fiveHour.error ? <span className="usage-error">{provider.fiveHour.error}</span> : <UsageChart usage={provider.fiveHour} accent={provider.accent} style={chartStyle} label="5h" />}
                <span>{resetText('5h', provider.fiveHour.resetAtLabel)}</span>
              </div>
              <div className="usage-window">
                {provider.weekly.error ? <span className="usage-error">{provider.weekly.error}</span> : <UsageChart usage={provider.weekly} accent={provider.accent} style={chartStyle} label="7d" />}
                <span>{resetText('7d', provider.weekly.resetAtLabel)}</span>
              </div>
            </div>
            <footer>
              <span>{provider.lastUpdatedLabel}</span>
              <span className="provider-meta-row">
                <span>{sourceLabel}</span>
                <span>{authLabel}</span>
              </span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
