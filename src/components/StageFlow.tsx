import { Link } from 'react-router-dom'
import { stageExceptionPct, type ProcessStage } from '../api'
import { formatCr } from '../lib/format'
import { statusColor } from '../theme/derive'
import { barHeights, colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'
import { Bar } from './Bar'
import { Eyebrow } from './Eyebrow'
import { StatusDot } from './StatusDot'

// Prototype scaling: the stage exception fill is exceptionPct * 3.4 % of the track width (spec/05).
const STAGE_FILL_SCALE = 3.4

export function StageFlow({ stages, to, stageTo }: { stages: ProcessStage[]; to: string; stageTo?: Record<string, string> }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCardInner }}>
      {/* §8.1 — these are open work in progress, not period volumes */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow style={typeScale.tableHeader}>In flight at each stage</Eyebrow>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>Open work in progress, not period volumes</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: spacing.gapStages }}>
        {stages.map((s) => (
          <Link
            key={s.step}
            id={`fct-stage-${s.step}`} // §8.2 — drill anchor target (e.g. #fct-stage-COL from the consequence strip)
            to={stageTo?.[s.step] ?? to}
            className="fct-stage-card"
            style={{ background: colors.bgPanel, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, color: colors.textPrimary, textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.12em', color: colors.textFaint }}>{s.step}</span>
              <StatusDot size={7} color={statusColor(s.status)} />
            </span>
            <span style={{ fontSize: 14, fontWeight: fontWeights.semibold }}>{s.name}</span>
            <span style={typeScale.stageVolume}>{s.inFlight.toLocaleString()}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{formatCr(s.inFlightValue)}</span>
            <Bar value={stageExceptionPct(s) * STAGE_FILL_SCALE} max={100} height={barHeights.stageRate + 2} color={statusColor(s.status)} />
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: s.status === 'GREEN' ? colors.textMuted : statusColor(s.status) }}>{`${stageExceptionPct(s)}% exception`}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
