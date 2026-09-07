import { barHeights, colors, radius, shadows } from '../theme/tokens'

interface BarProps {
  value: number
  max?: number
  height?: number
  color?: string
}

// Clay meter: an inset track with a raised fill. Default fill is the cool data hue,
// never the accent — a bar must not read as a button (DESIGN-CLAY.md, data hue rule).
export function Bar({ value, max = 1, height = barHeights.inlineMeter, color = colors.ageingBarAlt }: BarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div style={{ width: '100%', height, background: colors.bgSelected, borderRadius: radius.sm, boxShadow: shadows.in, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 1, bottom: 1, left: 1, width: `calc(${ratio * 100}% - 2px)`, minWidth: ratio > 0 ? 2 : 0, background: color, borderRadius: radius.sm }} />
    </div>
  )
}
