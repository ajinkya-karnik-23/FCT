import type { CSSProperties } from 'react'
import { colors, fonts } from '../theme/tokens'

// §8.7 — every screen header carries source + timestamp; mixed-source screens list them all.
interface FreshnessStampProps {
  sources: string[]
  style?: CSSProperties
}

export function FreshnessStamp({ sources, style }: FreshnessStampProps) {
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaintest, ...style }}>
      {[...sources, 'as of 06:00 IST'].join(' · ')}
    </span>
  )
}
