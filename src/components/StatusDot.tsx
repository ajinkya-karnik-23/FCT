import { animation, colors, radius } from '../theme/tokens'

interface StatusDotProps {
  color?: string
  size?: number
  pulse?: boolean
}

export function StatusDot({ color = colors.accent, size = 7, pulse = false }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: radius.dot,
        background: color,
        animation: pulse ? animation.pulse : undefined,
      }}
    />
  )
}
