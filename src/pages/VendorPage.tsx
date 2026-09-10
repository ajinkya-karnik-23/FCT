import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, getCause, getException, listCounterparties } from '../api'
import type { Exception } from '../api'
import { AgeingChart, DataTable, Eyebrow, FreshnessStamp, type Column } from '../components'
import { formatCr } from '../lib/format'
import { ageColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }

export function VendorPage() {
  const { code, id } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Vendor</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const vendor = listCounterparties(entity.code, 'vendor').find((c) => c.id === id)
  if (!vendor) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Vendor</Eyebrow>
        <h1 style={titleStyle}>{`Unknown vendor ${id}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This vendor is not in the entity's blocked-invoice population.</p>
        <Link to={`/entity/${code}/p2p/invoices`} className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to worklist
        </Link>
      </div>
    )
  }

  const causeName = (key: string) => getCause(key)?.name ?? key
  const items = vendor.openItems.map((x) => getException(x)).filter((x): x is Exception => !!x)

  const metrics = [
    { label: 'OPEN COMMITMENTS', value: formatCr(vendor.openCommitmentsCr) },
    { label: 'BLOCKED INVOICES', value: `${formatCr(vendor.blockedCr)} · ${items.length}` },
    { label: 'DISPUTES', value: formatCr(vendor.disputesCr) },
    { label: 'YTD SPEND', value: formatCr(vendor.ytdSpendCr ?? 0) },
    { label: 'LAST PAYMENT', value: vendor.lastPaymentDate ?? '—' },
  ]

  const columns: Array<Column<Exception>> = [
    {
      width: '130px',
      header: 'Invoice',
      render: (x) => (
        <Link to={`/entity/${code}/p2p/invoices/${x.id}`} style={{ fontFamily: fonts.mono, color: colors.accentText, textDecoration: 'none' }}>
          {x.id}
        </Link>
      ),
    },
    { width: '130px', align: 'right', header: 'Amount', render: (x) => <span style={{ fontFamily: fonts.mono }}>{formatCr(x.amount, 2)}</span> },
    { width: '90px', align: 'right', header: 'Age', render: (x) => <span style={{ fontFamily: fonts.mono, color: ageColor(x.ageDays) }}>{`${x.ageDays} d`}</span> },
    { width: '170px', header: 'Blocking reason', render: (x) => <span style={{ color: colors.textSecondary }}>{causeName(x.reasonKey)}</span> },
    { width: '130px', header: 'Plant', render: (x) => <span style={{ color: colors.textSecondary }}>{x.plant}</span> },
    { width: '130px', header: 'Owner', render: (x) => <span style={{ color: colors.textSecondary }}>{x.owner}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 5 — Counterparty · Vendor</Eyebrow>
          <h1 style={titleStyle}>{vendor.name}</h1>
          {/* §8.7 — the vendor's items are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.24 — the vendor's blocked value is a slice of the worklist total; the tie holds per entity */}
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${items.length} open items · ${formatCr(vendor.blockedCr)} blocked`}</span>
      </div>

      <div style={{ display: 'flex', gap: 34 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={typeScale.tileValue}>{m.value}</span>
          </div>
        ))}
      </div>

      <AgeingChart title="Blocked value by age" buckets={vendor.ageingBuckets} />

      <section style={{ ...clay.frame, fontSize: 13 }}>
        <DataTable columns={columns} rows={items} rowKey={(x) => x.id} />
      </section>
    </div>
  )
}
