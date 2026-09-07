import type { CSSProperties, ReactNode } from 'react'
import { card } from '../theme/clay'
import { Eyebrow } from './Eyebrow'

interface CardProps {
  eyebrow?: ReactNode
  children: ReactNode
  style?: CSSProperties
}

// A raised clay panel — one readable object. Rows inside a table use the frame recipe instead.
export function Card({ eyebrow, children, style }: CardProps) {
  return (
    <section style={{ ...card, ...style }}>
      {eyebrow != null ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {children}
    </section>
  )
}
