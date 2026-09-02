import { DIMENSION_DEFINITIONS, DIMENSION_LABELS, pointDirection, type DimensionKey } from '../api'
import { scoreColor, trendColor } from '../theme/derive'
import { barHeights, colors, fontWeights, fonts } from '../theme/tokens'
import { Bar } from './Bar'

interface DimensionBarProps {
  dimension: DimensionKey
  value: number // 0-100
  previous?: number // §7.15 — prior-period score; when present a two-point delta trails the value
}

// §3.1 — a named, scored dimension: the label and numeric score always sit beside the RAG bar,
// so colour is never the only carrier of meaning. With a prior period (§7.15) the signed delta
// follows improvement (higher = better), coloured via trendColor like every other trend.
export function DimensionBar({ dimension, value, previous }: DimensionBarProps) {
  return (
    // §8.6.1 — a dimension score states what it counts on hover; the text lives with the accessor, not here.
    <div title={DIMENSION_DEFINITIONS[dimension]} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 11, color: colors.textMuted }}>{DIMENSION_LABELS[dimension]}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: fontWeights.semibold, color: scoreColor(value) }}>
            {value}
          </span>
          {previous !== undefined && (
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: trendColor(pointDirection(value, previous, false)) }}>
              {`${value - previous > 0 ? '+' : ''}${value - previous}`}
            </span>
          )}
        </span>
      </span>
      <Bar value={value} max={100} height={barHeights.inlineMeter} color={scoreColor(value)} />
    </div>
  )
}
