import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, listCostCentres } from '../api'
import { Bar, DataTable, Eyebrow, FreshnessStamp, type Column } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }

interface PoRow {
  po: string
  valueCr: number
}

export function CostCentrePage() {
  const { code, id } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Cost centre</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const centre = listCostCentres(entity.code).find((c) => c.id === id)
  if (!centre) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Cost centre</Eyebrow>
        <h1 style={titleStyle}>{`Unknown cost centre ${id}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This cost centre is not in the entity's budget plan.</p>
        <Link to={`/entity/${code}/p2p`} className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to P2P cockpit
        </Link>
      </div>
    )
  }

  // §7.24 — remaining budget is only real once open POs are counted against it; negative means over budget on commitments.
  const remaining = centre.budgetCr - centre.bookedSpendCr - centre.committedSpendCr

  const metrics: Array<{ label: string; value: string; negative?: boolean }> = [
    { label: 'BUDGET', value: formatCr(centre.budgetCr) },
    { label: 'BOOKED SPEND', value: formatCr(centre.bookedSpendCr) },
    { label: 'COMMITTED (OPEN POS)', value: formatCr(centre.committedSpendCr) },
    { label: 'REMAINING AFTER COMMITMENTS', value: formatCr(remaining), negative: remaining < 0 },
  ]

  const poColumns: Array<Column<PoRow>> = [
    { width: '160px', header: 'PO', render: (p) => <span style={{ fontFamily: fonts.mono }}>{p.po}</span> },
    { align: 'right', header: 'Value', render: (p) => <span style={{ fontFamily: fonts.mono }}>{formatCr(p.valueCr)}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 5 — Counterparty · Cost centre</Eyebrow>
          <h1 style={titleStyle}>{centre.name}</h1>
          {/* §8.7 — the cost centre's POs are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.24 — committed spend is the part most tools miss; it ties to the PO stage in-flight value */}
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${centre.openPos.length} open POs · ${formatCr(centre.committedSpendCr)} committed`}</span>
      </div>

      <div style={{ display: 'flex', gap: 34 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={{ ...typeScale.tileValue, color: m.negative ? colors.statusRed : undefined }}>{m.value}</span>
          </div>
        ))}
      </div>

      <section style={{ ...clay.card, padding: 20 }}>
        <Eyebrow style={typeScale.tableHeader}>Booked and committed against budget</Eyebrow>
        {[
          { label: 'Booked spend', value: centre.bookedSpendCr, color: colors.accent },
          { label: 'Committed (open POs)', value: centre.committedSpendCr, color: colors.statusAmber },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ width: 170, flexShrink: 0 }}>{row.label}</span>
            <span style={{ flex: 1 }}>
              <Bar value={row.value} max={centre.budgetCr} color={row.color} />
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 70, textAlign: 'right' }}>{formatCr(row.value)}</span>
          </div>
        ))}
      </section>

      <section style={{ ...clay.frame, fontSize: 13 }}>
        <DataTable columns={poColumns} rows={centre.openPos} rowKey={(p) => p.po} />
        {remaining < 0 && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.borderSubtle}`, color: colors.statusRed }}>
            Over budget once commitments land — booked plus committed exceeds the plan by {formatCr(Math.abs(remaining))}.
          </div>
        )}
      </section>
    </div>
  )
}
