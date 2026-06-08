import type { ChartStyle, WindowUsageState } from '../../app/types'

type UsageChartProps = {
  usage: WindowUsageState
  accent: string
  style: ChartStyle
  label: string
}

const clampPercent = (value: number): number => Math.max(0, Math.min(1, value))
const formatPercent = (value: number): string => `${Math.round(clampPercent(value) * 100)}%`

export function UsageChart({ usage, accent, style, label }: UsageChartProps) {
  const percent = clampPercent(usage.usedPercent)

  if (style === 'numeric') {
    return (
      <div className="numeric-chart">
        <span>{formatPercent(percent)}</span>
        <small>{label}</small>
      </div>
    )
  }

  if (style === 'bar') {
    return (
      <div className="bar-chart" aria-label={`${label} ${formatPercent(percent)}`}>
        <div className="bar-chart__track">
          <div className="bar-chart__fill" style={{ width: `${percent * 100}%`, background: accent }} />
        </div>
        <span>{formatPercent(percent)}</span>
      </div>
    )
  }

  if (style === 'stepped') {
    const steps = Array.from({ length: 10 }, (_, index) => index / 10 < percent)
    return (
      <div className="stepped-chart" aria-label={`${label} ${formatPercent(percent)}`}>
        {steps.map((active, index) => (
          <span key={index} className={active ? 'stepped-chart__step stepped-chart__step--active' : 'stepped-chart__step'} style={{ background: active ? accent : undefined }} />
        ))}
      </div>
    )
  }

  if (style === 'sparkline') {
    const points = [0.18, 0.24, 0.2, 0.38, 0.44, 0.39, 0.58, percent]
      .map((point, index) => `${index * 14},${44 - point * 36}`)
      .join(' ')
    return (
      <svg className="spark-chart" viewBox="0 0 98 48" role="img" aria-label={`${label} ${formatPercent(percent)}`}>
        <polyline points={points} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent)

  return (
    <svg className="ring-chart" viewBox="0 0 92 92" role="img" aria-label={`${label} ${formatPercent(percent)}`}>
      <circle cx="46" cy="46" r={radius} className="ring-chart__track" />
      <circle
        cx="46"
        cy="46"
        r={radius}
        className="ring-chart__value"
        stroke={accent}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text x="46" y="50" textAnchor="middle">{formatPercent(percent)}</text>
    </svg>
  )
}
