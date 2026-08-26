import type { CSSProperties } from 'react'
import type { AgeingBucket } from '../api'
import { formatCr } from '../lib/format'
import { colors, fonts, typeScale } from '../theme/tokens'
import { Eyebrow } from './Eyebrow'

const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }

export function AgeingChart({ title, buckets }: { title: string; buckets: AgeingBucket[] }) {
  const maxBucket = Math.max(...buckets.map((b) => b.value))
  // Spec: the two largest buckets take the accent, the rest the secondary blue.
  const topTwo = new Set(buckets.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((b) => b.label))

  return (
    <section style={cardStyle}>
      <Eyebrow style={typeScale.tableHeader}>{title}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{formatCr(b.value)}</span>
            <div style={{ width: '100%', height: Math.round((b.value / maxBucket) * 100), background: topTwo.has(b.label) ? colors.accent : colors.ageingBarAlt }} />
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
