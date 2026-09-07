import type { CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { commitmentsWatch, getEntity, poDaysOut } from '../api'
import type { PurchaseOrder } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, StatusDot, type Column } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }

// Local date label (same shape as ExceptionDetail's) — the api surface does not export a formatter.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

// §15.7 — chase state per row; colours are the token status set only.
const STATE_STYLE: Record<PurchaseOrder['chaseState'], { label: string; color: string }> = {
  'on-track': { label: 'ON TRACK', color: colors.textMuted },
  chased: { label: 'CHASED', color: colors.statusAmber },
  amended: { label: 'AMENDED', color: colors.statusGreen },
  proposed: { label: 'PROPOSED · ESCALATED', color: colors.statusRed },
}

function StateBadge({ state }: { state: PurchaseOrder['chaseState'] }) {
  const s = STATE_STYLE[state]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: s.color }}>
      <StatusDot size={7} color={s.color} />
      {s.label}
    </span>
  )
}

export function CommitmentsWatch() {
  const { code } = useParams()
  const navigate = useNavigate()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Commitments watch</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const watch = commitmentsWatch(entity.code)
  // §15.2.1 — the claim stated precisely: true commitment data, not fewer blocked invoices. The figure is the entity's
  // own accrual exposure (§8.2), so JGL reads ₹6.4 cr and every other entity its own number.
  const claim = `This agent keeps the commitment data true. Committed spend, accrual planning and close exposure all depend on delivery dates being accurate — a stale date silently corrupts the ${formatCr(entity.metrics.accrualExposure ?? 0)} accrual estimate at close.`

  const columns: Array<Column<PurchaseOrder>> = [
    { width: '120px', header: 'PO', render: (po) => <span style={{ fontFamily: fonts.mono }}>{po.id}</span> },
    { header: 'Vendor', render: (po) => po.vendorName },
    { width: '130px', header: 'Owner', render: (po) => po.ownerName },
    { align: 'right', width: '110px', header: 'Value', render: (po) => <span style={{ fontFamily: fonts.mono }}>{formatCr(po.valueCr)}</span> },
    {
      width: '230px', header: 'Delivery date',
      render: (po) => {
        if (po.chaseState === 'amended') return <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{`${formatDay(po.deliveryDate)} · was ${formatDay(po.originalDeliveryDate!)}`}</span>
        if (po.chaseState === 'proposed') return <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{`${formatDay(po.deliveryDate)} · proposal pending`}</span>
        const d = poDaysOut(po)
        return <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{`${formatDay(po.deliveryDate)} · ${d}d out`}</span>
      },
    },
    { width: '170px', header: 'Chase state', render: (po) => <StateBadge state={po.chaseState} /> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 3 — Process · Commitments</Eyebrow>
          <h1 style={titleStyle}>Commitments watch</h1>
          {/* §8.7 — open POs and their delivery dates are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        <Link to={`/entity/${code}/p2p`} className="fct-link" style={{ padding: '10px 12px', fontSize: 13, color: colors.textSecondary, textDecoration: 'none' }}>
          ← Back to P2P cockpit
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap' }}>
        {[
          { label: 'OPEN POS', value: watch.openPosCount.toLocaleString(), sub: `the PO stage pool — ${watch.pos.length} named here` },
          { label: 'COMMITTED VALUE', value: formatCr(watch.committedCr), sub: 'ties to cost-centre commitments' },
          { label: 'VALUE AT RISK OF SLIPPING', value: formatCr(watch.valueAtRiskCr), red: true, sub: `${watch.chasedCount} chased · ${watch.proposedCount} proposed — date not yet confirmed` },
          { label: 'AMENDMENTS MADE', value: String(watch.amendedCount), sub: 'date only, on the owner’s reply' },
        ].map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={{ ...typeScale.tileValue, color: m.red ? colors.statusRed : undefined }}>{m.value}</span>
            <span style={{ fontSize: 11, color: colors.textMuted }}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* §15.2.1 — the claim stated precisely; amending PO dates does not stop vendors invoicing early */}
      <section data-fct-commitments-claim style={{ ...cardStyle, gap: 8 }}>
        <Eyebrow style={typeScale.tableHeader}>What this agent protects</Eyebrow>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: colors.textSecondary }}>{claim}</p>
      </section>

      <section data-fct-commitments-watch style={{ ...cardStyle, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Open POs by delivery date</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${watch.pos.length} named rows · sample of ${watch.openPosCount.toLocaleString()} open`}</span>
        </div>
        <DataTable columns={columns} rows={watch.pos} rowKey={(po) => po.id} onRowClick={(po) => navigate(`/entity/${code}/p2p/commitments/${po.id}`)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontSize: 12, color: colors.textMuted }}>
          <span>Named rows are the cost-centre pool — same POs, same values</span>
          <span style={{ fontFamily: fonts.mono }}>{formatCr(watch.committedCr)} committed</span>
        </div>
      </section>
    </div>
  )
}
