import type { AgeingBucket } from '../api'
import { formatCr } from '../lib/format'
import { card } from '../theme/clay'
import { colors, fonts, radius, typeScale } from '../theme/tokens'
import { Eyebrow } from './Eyebrow'

export function AgeingChart({ title, buckets }: { title: string; buckets: AgeingBucket[] }) {
  const maxBucket = Math.max(...buckets.map((b) => b.value))
  // One hue for magnitude: the two largest buckets take the full data hue, the rest a lighter step of it.
  // Never the accent — bars are data, not controls.
  const topTwo = new Set(buckets.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((b) => b.label))

  return (
    <section style={{ ...card, gap: 16 }}>
      <Eyebrow style={typeScale.tableHeader}>{title}</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
        {buckets.map((b) => (
          <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{formatCr(b.value)}</span>
            <div
              style={{
                width: '100%',
                height: Math.round((b.value / maxBucket) * 100),
                background: colors.ageingBarAlt,
                opacity: topTwo.has(b.label) ? 1 : 0.55,
                borderRadius: `${radius.sm} ${radius.sm} 3px 3px`,
              }}
            />
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
