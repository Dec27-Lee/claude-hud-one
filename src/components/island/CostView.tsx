import type { CostStyle, CostSummaryState, ProviderId, ProviderState, TokenCountMode } from '../../app/types'
import { ProviderBreakdown } from '../charts/ProviderBreakdown'

type CostViewProps = {
  providers: ProviderState[]
  cost: Record<ProviderId, CostSummaryState>
  costStyle: CostStyle
  tokenCountMode: TokenCountMode
}

const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return `${value}`
}

const styleLabel: Record<CostStyle, string> = {
  usd: 'USD',
  value: 'VALUE',
  tokens: 'TOKENS',
  trend: 'TREND',
}

const heroValue = (summary: CostSummaryState, costStyle: CostStyle, todayTokens: number): string => {
  if (costStyle === 'tokens') return compactNumber(todayTokens)
  if (costStyle === 'value') {
    const perMillion = todayTokens === 0 ? 0 : (summary.todayUsd / todayTokens) * 1_000_000
    return `$${perMillion.toFixed(2)}`
  }
  return `$${summary.todayUsd.toFixed(2)}`
}

export function CostView({ providers, cost, costStyle, tokenCountMode }: CostViewProps) {
  const visibleProviders = providers.filter((provider) => provider.visible)

  if (visibleProviders.length === 0) {
    return <div className="empty-state">Cost 仍在后台扫描，但当前没有可见的 Claude provider。</div>
  }

  return (
    <div className="cost-grid">
      {visibleProviders.map((provider) => {
        const summary = cost[provider.id]
        const todayTokens = tokenCountMode === 'all' ? summary.todayTokens : summary.todayBillableTokens
        const monthTokens = tokenCountMode === 'all' ? summary.monthTokens : summary.monthBillableTokens
        const perMillion = monthTokens === 0 ? 0 : (summary.monthUsd / monthTokens) * 1_000_000
        return (
          <article className={`cost-card cost-card--${costStyle}`} key={provider.id}>
            <div className="provider-card__header">
              <div>
                <span className="section-kicker">{provider.name} · {styleLabel[costStyle]}</span>
                <h3>{heroValue(summary, costStyle, todayTokens)}</h3>
              </div>
              <span className="provider-dot" style={{ background: provider.accent }} />
            </div>
            <div className="metric-row">
              <span>{costStyle === 'value' ? 'Cost / 1M tokens' : 'Today'}</span>
              <b>{costStyle === 'tokens' ? compactNumber(todayTokens) : costStyle === 'value' ? `$${perMillion.toFixed(2)}` : `$${summary.todayUsd.toFixed(2)}`}</b>
            </div>
            <div className="metric-row">
              <span>{costStyle === 'value' ? 'Month tokens' : 'Month to date'}</span>
              <b>{costStyle === 'tokens' || costStyle === 'value' ? compactNumber(monthTokens) : `$${summary.monthUsd.toFixed(2)}`}</b>
            </div>
            <div className={costStyle === 'trend' ? 'trend-bars trend-bars--hero' : 'trend-bars'} aria-label={`${provider.name} trend`}>
              {summary.trend.map((value, index) => {
                const max = Math.max(...summary.trend, 1)
                const height = max === 0 ? 8 : Math.max(8, (value / max) * (costStyle === 'trend' ? 88 : 52))
                return <span key={index} style={{ height, background: provider.accent }} />
              })}
            </div>
            <ProviderBreakdown title="Recent model mix" items={summary.breakdown} mode={costStyle === 'tokens' ? 'tokens' : 'dollars'} />
          </article>
        )
      })}
    </div>
  )
}
