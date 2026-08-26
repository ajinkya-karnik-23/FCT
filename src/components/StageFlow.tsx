import { Link } from 'react-router-dom'
import type { ProcessStage } from '../api'
import { formatCr } from '../lib/format'
import { statusColor } from '../theme/derive'
import { barHeights, colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'
import { Bar } from './Bar'
import { StatusDot } from './StatusDot'

// Prototype scaling: the stage exception fill is exceptionPct * 3.4 % of the track width (spec/05).
const STAGE_FILL_SCALE = 3.4

export function StageFlow({ stages, to }: { stages: ProcessStage[]; to: string }) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: spacing.gapStages }}>
      {stages.map((s) => (
        <Link
          key={s.step}
          to={to}
          className="fct-stage-card"
          style={{ background: colors.bgPanel, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, color: colors.textPrimary, textDecoration: 'none' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.12em', color: colors.textFaint }}>{s.step}</span>
            <StatusDot size={7} color={statusColor(s.status)} />
          </span>
          <span style={{ fontSize: 14, fontWeight: fontWeights.semibold }}>{s.name}</span>
          <span style={typeScale.stageVolume}>{s.volume.toLocaleString()}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{formatCr(s.value)}</span>
          <Bar value={s.exceptionPct * STAGE_FILL_SCALE} max={100} height={barHeights.stageRate} color={statusColor(s.status)} />
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: s.status === 'GREEN' ? colors.textMuted : statusColor(s.status) }}>{`${s.exceptionPct}% exception`}</span>
        </Link>
      ))}
    </section>
  )
}
