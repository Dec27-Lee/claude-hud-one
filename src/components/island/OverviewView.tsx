import { useMemo, useState } from 'react'
import type { DailyTokenBucket } from '../../app/types'

type OverviewViewProps = {
  buckets: DailyTokenBucket[]
  showCodex: boolean
}

const compactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return `${value}`
}

const displayedTotal = (bucket: DailyTokenBucket, showCodex: boolean): number => bucket.claudeTokens + (showCodex ? bucket.codexTokens : 0)

const bucketClassName = (bucket: DailyTokenBucket, max: number, showCodex: boolean): string => {
  const totalTokens = displayedTotal(bucket, showCodex)
  if (totalTokens === 0) return 'overview-cell overview-cell--empty'
  const intensity = Math.ceil((totalTokens / max) * 4)
  if (!showCodex || bucket.claudeTokens > bucket.codexTokens * 1.25) return `overview-cell overview-cell--claude overview-cell--${intensity}`
  if (bucket.codexTokens > bucket.claudeTokens * 1.25) return `overview-cell overview-cell--codex overview-cell--${intensity}`
  return `overview-cell overview-cell--mixed overview-cell--${intensity}`
}

export function OverviewView({ buckets, showCodex }: OverviewViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const selected = buckets.find((bucket) => bucket.date === selectedDate)
  const total = buckets.reduce((sum, bucket) => sum + displayedTotal(bucket, showCodex), 0)
  const activeDays = buckets.filter((bucket) => displayedTotal(bucket, showCodex) > 0).length
  const claudeTotal = buckets.reduce((sum, bucket) => sum + bucket.claudeTokens, 0)
  const codexTotal = buckets.reduce((sum, bucket) => sum + bucket.codexTokens, 0)
  const max = useMemo(() => Math.max(...buckets.map((bucket) => displayedTotal(bucket, showCodex)), 1), [buckets, showCodex])

  return (
    <div className="overview-view">
      <div className="overview-summary">
        <div><span className="section-kicker">Year tokens</span><b>{compactNumber(total)}</b></div>
        <div><span className="section-kicker">Active days</span><b>{activeDays}</b></div>
        <div><span className="section-kicker">Claude tokens</span><b>{showCodex ? `${compactNumber(claudeTotal)} / ${compactNumber(codexTotal)}` : compactNumber(claudeTotal)}</b></div>
      </div>
      <div className="overview-grid">
        {buckets.map((bucket) => (
          <button
            key={bucket.date}
            className={bucketClassName(bucket, max, showCodex)}
            title={`${bucket.date}: ${compactNumber(displayedTotal(bucket, showCodex))} tokens`}
            onClick={() => setSelectedDate((current) => (current === bucket.date ? null : bucket.date))}
          />
        ))}
      </div>
      {selected ? (
        <div className="day-detail-strip">
          <strong>{selected.date}</strong>
          <span>Total {compactNumber(displayedTotal(selected, showCodex))}</span>
          <span>Claude {compactNumber(selected.claudeTokens)}</span>
          {showCodex ? <span>Codex {compactNumber(selected.codexTokens)}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
