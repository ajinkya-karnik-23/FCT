import { barHeights, colors } from '../theme/tokens'

interface BarProps {
  value: number
  max?: number
  height?: number
  color?: string
}

export function Bar({ value, max = 1, height = barHeights.inlineMeter, color = colors.accent }: BarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div style={{ width: '100%', height, background: colors.borderSubtle }}>
      <div style={{ height: '100%', width: `${ratio * 100}%`, background: color }} />
    </div>
  )
}
