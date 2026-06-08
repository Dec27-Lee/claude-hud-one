import { useMemo, useState } from 'react'
import type { DailyTokenBucket } from '../../app/types'

type OverviewViewProps = {
  buckets: DailyTokenBucket[]
}

const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return `${value}`
}

const bucketClassName = (bucket: DailyTokenBucket, max: number): string => {
  if (bucket.totalTokens === 0) return 'overview-cell overview-cell--empty'
  const intensity = Math.ceil((bucket.totalTokens / max) * 4)
  if (bucket.claudeTokens > bucket.codexTokens * 1.25) return `overview-cell overview-cell--claude overview-cell--${intensity}`
  if (bucket.codexTokens > bucket.claudeTokens * 1.25) return `overview-cell overview-cell--codex overview-cell--${intensity}`
  return `overview-cell overview-cell--mixed overview-cell--${intensity}`
}

export function OverviewView({ buckets }: OverviewViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const selected = buckets.find((bucket) => bucket.date === selectedDate)
  const total = buckets.reduce((sum, bucket) => sum + bucket.totalTokens, 0)
  const activeDays = buckets.filter((bucket) => bucket.totalTokens > 0).length
  const claudeTotal = buckets.reduce((sum, bucket) => sum + bucket.claudeTokens, 0)
  const codexTotal = buckets.reduce((sum, bucket) => sum + bucket.codexTokens, 0)
  const max = useMemo(() => Math.max(...buckets.map((bucket) => bucket.totalTokens), 1), [buckets])

  return (
    <div className="overview-view">
      <div className="overview-summary">
        <div><span className="section-kicker">Year tokens</span><b>{compactNumber(total)}</b></div>
        <div><span className="section-kicker">Active days</span><b>{activeDays}</b></div>
        <div><span className="section-kicker">Split</span><b>{compactNumber(claudeTotal)} / {compactNumber(codexTotal)}</b></div>
      </div>
      <div className="overview-grid">
        {buckets.map((bucket) => (
          <button
            key={bucket.date}
            className={bucketClassName(bucket, max)}
            title={`${bucket.date}: ${compactNumber(bucket.totalTokens)} tokens`}
            onClick={() => setSelectedDate((current) => (current === bucket.date ? null : bucket.date))}
          />
        ))}
      </div>
      {selected ? (
        <div className="day-detail-strip">
          <strong>{selected.date}</strong>
          <span>Total {compactNumber(selected.totalTokens)}</span>
          <span>Claude {compactNumber(selected.claudeTokens)}</span>
          <span>Codex {compactNumber(selected.codexTokens)}</span>
        </div>
      ) : null}
    </div>
  )
}
