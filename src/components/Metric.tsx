import type { CSSProperties } from 'react'
import { trendDelta } from '../api'
import type { Trend } from '../api'
import { trendColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'

// §8.3 — every headline number shows direction of travel: value, delta vs prior period,
// and a six-period sparkline. Direction colour follows improvement (inverse flag), not sign.
export function Metric({ label, value, trend, inverse, compact = false, valueStyle }: {
  label?: string
  value: string // pre-formatted at the call site — formatCr() for money
  trend: Trend
  inverse: boolean | null // §8.5.1 — true when lower is better; null = direction-neutral (DPO)
  compact?: boolean // table-cell mode: smaller type, right-aligned
  valueStyle?: CSSProperties
}) {
  const delta = trendDelta(trend, inverse)
  const color = trendColor(delta.direction)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
      {label && (
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textFaint }}>{label}</span>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: compact ? 'flex-end' : 'space-between', gap: 8 }}>
        <span style={compact ? { fontFamily: fonts.mono, fontSize: 13, fontVariantNumeric: 'tabular-nums', ...valueStyle } : valueStyle ?? typeScale.tileValue}>{value}</span>
        <span style={{ fontFamily: fonts.mono, fontSize: compact ? 10 : 12, color }}>{`${delta.percent > 0 ? '+' : ''}${delta.percent}%`}</span>
      </div>
      <Sparkline series={trend.series} color={color} width={compact ? 56 : 72} alignEnd={compact} />
    </div>
  )
}

function Sparkline({ series, color, width, alignEnd = false }: { series: number[]; color: string; width: number; alignEnd?: boolean }) {
  const height = 18
  const pad = 2
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1 // flat series — centre the line instead of dividing by zero
  const stepX = (width - pad * 2) / (series.length - 1)
  const points = series.map((v, i) => `${(pad + i * stepX).toFixed(2)},${(height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(2)}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', marginLeft: alignEnd ? 'auto' : undefined }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}
