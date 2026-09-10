import type { CSSProperties, ReactNode } from 'react'
import { typeScale } from '../theme/tokens'

interface EyebrowProps {
  children: ReactNode
  style?: CSSProperties
}

export function Eyebrow({ children, style }: EyebrowProps) {
  return <span style={{ ...typeScale.eyebrow, ...style }}>{children}</span>
}
