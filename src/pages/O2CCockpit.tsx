import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getO2cKpis, getO2cServiceControl, getReceivablesAgeing, listCauses, listStages } from '../api'
import { AgeingChart, Bar, Eyebrow, StageFlow } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }

// Top-causes rows use the same insight scale as the entity home.
const CAUSE_FILL_SCALE = 2.6

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 26, color }}>{value}</span>
    </div>
  )
}

export function O2CCockpit() {
  const { code } = useParams()
  const kpis = getO2cKpis()
  const stages = listStages('o2c')
  const causes = listCauses('o2c')
  const ageing = getReceivablesAgeing()
  const service = getO2cServiceControl()

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 2 — Process · Order to Cash</Eyebrow>
          <h1 style={titleStyle}>Revenue to cash, as one flow</h1>
        </div>
        <div style={{ display: 'flex', gap: 34 }}>
          <Kpi label="DSO" value={`${kpis.dsoDays} d`} color={colors.statusAmber} />
          <Kpi label="OVERDUE AR" value={formatCr(kpis.overdueArCr)} color={colors.textPrimary} />
          <Kpi label="UNAPPLIED" value={formatCr(kpis.unappliedCr)} color={colors.statusRed} />
        </div>
      </div>

      <StageFlow stages={stages} to={`/entity/${code}/working-capital`} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.gapCards }}>
        <AgeingChart title="Receivables by ageing" buckets={ageing} />

        <section style={{ ...cardStyle, gap: 14 }}>
          <Eyebrow style={typeScale.tableHeader}>Top causes — O2C taxonomy</Eyebrow>
          {causes.map((c) => (
            <Link
              key={c.key}
              to={`/entity/${code}/root-cause/o2c/${c.key}`}
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
              <span>Billing accuracy</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusAmber }}>{`${service.billingAccuracyPct}%`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Open disputes</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusRed }}>{service.openDisputes}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Orders on credit block</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusAmber }}>{service.ordersOnCreditBlock}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>Unapplied receipts</span>
              <span style={{ fontFamily: fonts.mono, color: colors.textPrimary }}>{service.unappliedReceipts}</span>
            </div>
          </div>
          <Link
            to={`/entity/${code}/working-capital`}
            className="fct-blocked-btn"
            style={{ marginTop: 'auto', padding: '9px 12px', fontSize: 13, textAlign: 'center', color: colors.textPrimary, textDecoration: 'none' }}
          >
            Open 41 overdue customers →
          </Link>
        </section>
      </div>
    </div>
  )
}
