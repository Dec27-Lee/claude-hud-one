import type { ModelBreakdownItem } from '../../app/types'

type ProviderBreakdownProps = {
  title: string
  items: ModelBreakdownItem[]
  mode: 'tokens' | 'dollars'
}

const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return `${value}`
}

export function ProviderBreakdown({ title, items, mode }: ProviderBreakdownProps) {
  return (
    <section className="breakdown-card">
      <div className="section-kicker">{title}</div>
      <div className="breakdown-list">
        {items.map((item) => {
          const value = mode === 'dollars' ? `$${item.dollars.toFixed(2)}` : compactNumber(item.tokens)
          return (
            <div className="breakdown-row" key={item.model}>
              <div>
                <strong>{item.model}</strong>
                <span>{Math.round(item.percent * 100)}% share</span>
              </div>
              <b>{value}</b>
            </div>
          )
        })}
      </div>
    </section>
  )
}
