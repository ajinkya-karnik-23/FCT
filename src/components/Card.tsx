import type { CSSProperties, ReactNode } from 'react'
import { colors, spacing } from '../theme/tokens'
import { Eyebrow } from './Eyebrow'

interface CardProps {
  eyebrow?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

export function Card({ eyebrow, children, style }: CardProps) {
  return (
    <section
      style={{
        background: colors.bgPanel,
        border: `1px solid ${colors.borderDefault}`,
        padding: spacing.cardPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.gapCardInner,
        ...style,
      }}
    >
      {eyebrow != null ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {children}
    </section>
  )
}
