import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, getCause, getPlantDetail, vendorRoute } from '../api'
import type { Exception } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, type Column } from '../components'
import { formatCr } from '../lib/format'
import { ageColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }

interface CauseRow {
  causeKey: string
  amountCr: number
}

export function PlantPage() {
  const { code, id } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Plant</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const detail = getPlantDetail(entity.code, id ?? '')
  if (!detail) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Plant</Eyebrow>
        <h1 style={titleStyle}>{`Unknown plant ${id}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This site is not in the entity's blocked-invoice population.</p>
        <Link to={`/entity/${code}/p2p/invoices`} className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to worklist
        </Link>
      </div>
    )
  }

  const { plant, items, byCause } = detail
  const causeName = (key: string) => getCause(key)?.name ?? key
  const vendorSpread = new Set(items.map((x) => x.vendor)).size
  // §7.20 — the worklist shows a sample of the pool; where the shown rows do not cover the plant figure, say so.
  const itemsTotal = items.reduce((sum, x) => sum + x.amount, 0)
  const partialSample = Math.abs(itemsTotal - plant.blockedCr) > 0.005

  const metrics = [
    { label: 'BLOCKED VALUE', value: formatCr(plant.blockedCr) },
    { label: 'GR COMPLIANCE', value: `${plant.grCompliancePct}%` },
    { label: 'OPEN ITEMS', value: String(items.length) },
    { label: 'VENDOR SPREAD', value: String(vendorSpread) },
  ]

  const causeColumns: Array<Column<CauseRow>> = [
    { header: 'Cause', render: (r) => <span style={{ color: colors.textSecondary }}>{causeName(r.causeKey)}</span> },
    { align: 'right', header: 'Blocked value', render: (r) => <span style={{ fontFamily: fonts.mono }}>{formatCr(r.amountCr, 2)}</span> },
  ]

  const itemColumns: Array<Column<Exception>> = [
    {
      width: '130px',
      header: 'Invoice',
      render: (x) => (
        <Link to={`/entity/${code}/p2p/invoices/${x.id}`} style={{ fontFamily: fonts.mono, color: colors.accentText, textDecoration: 'none' }}>
          {x.id}
        </Link>
      ),
    },
    {
      width: '1fr',
      header: 'Vendor',
      render: (x) => {
        const to = vendorRoute(entity.code, x.vendor)
        return to ? <Link to={to} style={{ color: colors.accentText, textDecoration: 'none' }}>{x.vendor}</Link> : x.vendor
      },
    },
    { width: '130px', align: 'right', header: 'Amount', render: (x) => <span style={{ fontFamily: fonts.mono }}>{formatCr(x.amount, 2)}</span> },
    { width: '90px', align: 'right', header: 'Age', render: (x) => <span style={{ fontFamily: fonts.mono, color: ageColor(x.ageDays) }}>{`${x.ageDays} d`}</span> },
    { width: '170px', header: 'Blocking reason', render: (x) => <span style={{ color: colors.textSecondary }}>{causeName(x.reasonKey)}</span> },
    { detail: true, header: 'Owner', render: (x) => <span style={{ color: colors.textSecondary }}>{x.owner}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 5 — Counterparty · Plant</Eyebrow>
          <h1 style={titleStyle}>{plant.name}</h1>
          {/* §8.7 — the plant's items are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.24 — the plant's blocked value is its share of the entity's blocked-AP pool; Σ plants = pool per entity */}
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${items.length} open items · ${formatCr(plant.blockedCr)} blocked`}</span>
      </div>

      <div style={{ display: 'flex', gap: 34 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={typeScale.tileValue}>{m.value}</span>
          </div>
        ))}
      </div>

      <section style={{ ...clay.frame, fontSize: 13 }}>
        <DataTable columns={causeColumns} rows={byCause} rowKey={(r) => r.causeKey} />
      </section>

      <section style={{ ...clay.frame, fontSize: 13 }}>
        <DataTable columns={itemColumns} rows={items} rowKey={(x) => x.id} />
        {partialSample && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.borderSubtle}`, color: colors.textMuted }}>
            Shown rows total {formatCr(itemsTotal, 2)}; the plant figure covers the full blocked population.
          </div>
        )}
      </section>
    </div>
  )
}
