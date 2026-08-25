import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBlockedInvoiceAgeing, getServiceControl, listCauses, listStages } from '../api'
import { Bar, Eyebrow, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { statusColor } from '../theme/derive'
import { barHeights, colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'

// Prototype scaling: the stage exception fill is exceptionPct * 3.4 % of the track width (spec/05).
const STAGE_FILL_SCALE = 3.4
// Top-causes rows use the same insight scale as the entity home.
const CAUSE_FILL_SCALE = 2.6

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }

export function P2PCockpit() {
  const { code } = useParams()
  const stages = listStages('p2p')
  const causes = listCauses('p2p')
  const ageing = getBlockedInvoiceAgeing()
  const service = getServiceControl()

  const maxBucket = Math.max(...ageing.map((b) => b.value))
  // Spec: the two largest buckets take the accent, the rest the secondary blue.
  const topTwo = new Set(ageing.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((b) => b.label))

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Level 2 — Process · Procure to Pay</Eyebrow>
        <h1 style={titleStyle}>End-to-end flow, not seven separate reports</h1>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: spacing.gapStages }}>
        {stages.map((s) => (
          <Link
            key={s.step}
            to={`/entity/${code}/p2p/invoices`}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.gapCards }}>
        <section style={{ ...cardStyle, gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Blocked invoices by ageing</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
            {ageing.map((b) => (
              <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{formatCr(b.value)}</span>
                <div style={{ width: '100%', height: Math.round((b.value / maxBucket) * 100), background: topTwo.has(b.label) ? colors.accent : colors.ageingBarAlt }} />
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...cardStyle, gap: 14 }}>
          <Eyebrow style={typeScale.tableHeader}>Top causes — click to drill</Eyebrow>
          {causes.map((c) => (
            <Link
              key={c.key}
              to={`/entity/${code}/root-cause/${c.key}`}
              className="fct-cause-row"
              style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: colors.textPrimary, textDecoration: 'none' }}
            >
              <span className="fct-cause-label" style={{ flex: 1 }}>{c.name}</span>
              <span style={{ width: 90, flexShrink: 0 }}>
                <Bar value={c.sharePct * CAUSE_FILL_SCALE} max={100} />
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 38, textAlign: 'right' }}>{`${c.sharePct}%`}</span>
            </Link>
          ))}
        </section>

        <section style={{ ...cardStyle, gap: 12 }}>
          <Eyebrow style={typeScale.tableHeader}>Service &amp; control</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>SLA on invoice booking</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusAmber }}>{`${service.slaInvoiceBookingPct}%`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Queries overdue</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusRed }}>{service.queriesOverdue}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Duplicate payment risk</span>
              <span style={{ fontFamily: fonts.mono }}>{formatCr(service.duplicatePaymentRiskCr)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Manual payment runs</span>
              <span style={{ fontFamily: fonts.mono }}>{service.manualPaymentRuns}</span>
            </div>
          </div>
          <Link
            to={`/entity/${code}/p2p/invoices`}
            className="fct-blocked-btn"
            style={{ marginTop: 'auto', padding: '9px 12px', fontSize: 13, textAlign: 'center', color: colors.textPrimary, textDecoration: 'none' }}
          >
            Open 327 blocked invoices →
          </Link>
        </section>
      </div>
    </div>
  )
}
