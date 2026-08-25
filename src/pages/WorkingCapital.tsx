import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCashOpportunities, getEntity, getPayablesByReason, getReceivablesAgeing } from '../api'
import { Eyebrow } from '../components'
import { formatCr } from '../lib/format'
import { barHeights, colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }
const tableGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 180px' }

// Spec/06 header KPIs — literal reference values, not part of the spec/03 datasets.
const KPIS = [
  { label: 'DSO', value: '62 d', color: colors.statusAmber },
  { label: 'DPO', value: '48 d', color: colors.textPrimary },
  { label: 'RELEASABLE', value: formatCr(4.2), color: colors.statusGreen },
]

function Kpi({ label, value, color }: (typeof KPIS)[number]) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 26, color }}>{value}</span>
    </div>
  )
}

export function WorkingCapital() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Working capital</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const ar = getReceivablesAgeing()
  const ap = getPayablesByReason()
  const opportunities = getCashOpportunities()
  const maxAr = Math.max(...ar.map((b) => b.value))
  const maxAp = Math.max(...ap.map((r) => r.value))

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Working capital</Eyebrow>
          <h1 style={titleStyle}>Cash locked in exceptions</h1>
        </div>
        <div style={{ display: 'flex', gap: 34 }}>
          {KPIS.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.gapCards }}>
        {/* Spec: buckets wider than 40% of the largest take the accent; older, narrower ones chart-ar-old */}
        <section style={cardStyle}>
          <Eyebrow style={typeScale.tableHeader}>Receivables ageing</Eyebrow>
          {ar.map((b) => {
            const width = Math.round((b.value / maxAr) * 100)
            return (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 80 }}>{b.label}</span>
                <div style={{ flex: 1, height: barHeights.ageing, background: colors.borderSubtle }}>
                  <div style={{ height: '100%', width: `${width}%`, background: width > 40 ? colors.accent : colors.chartArOld }} />
                </div>
                <span style={{ fontFamily: fonts.mono, width: 90, textAlign: 'right' }}>{formatCr(b.value)}</span>
              </div>
            )
          })}
        </section>

        <section style={cardStyle}>
          <Eyebrow style={typeScale.tableHeader}>Payables blocked by reason</Eyebrow>
          {ap.map((r) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
              <span style={{ width: 150, flexShrink: 0 }}>{r.name}</span>
              <div style={{ flex: 1, height: barHeights.ageing, background: colors.borderSubtle }}>
                <div style={{ height: '100%', width: `${Math.round((r.value / maxAp) * 100)}%`, background: colors.accent }} />
              </div>
              <span style={{ fontFamily: fonts.mono, width: 90, textAlign: 'right' }}>{formatCr(r.value)}</span>
            </div>
          ))}
        </section>
      </div>

      {/* Cash opportunity table — rows are informational, not clickable */}
      <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
        <div style={{ ...tableGrid, padding: '12px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
          <span style={typeScale.tableHeader}>Cash opportunity</span>
          <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Value</span>
          <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Items</span>
          <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Effort</span>
          <span style={typeScale.tableHeader}>Owner</span>
        </div>
        {opportunities.map((o) => (
          <div key={o.name} style={{ ...tableGrid, padding: '14px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, alignItems: 'center', fontSize: 13 }}>
            <span>{o.name}</span>
            <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: colors.statusGreen }}>{formatCr(o.value)}</span>
            <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: colors.textSecondary }}>{o.items}</span>
            <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: colors.textSecondary }}>{o.effort}</span>
            <span style={{ color: colors.textSecondary }}>{o.owner}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
