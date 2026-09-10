import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { entityTileSubs, getBlockedInvoiceAgeing, getEntity, getServiceControl, listCauses, listCostCentres, listStages } from '../api'
import { AgeingChart, Bar, Eyebrow, FreshnessStamp, Metric, StageFlow } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

// Top-causes rows use the same insight scale as the entity home.
const CAUSE_FILL_SCALE = 2.6

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 20, gap: 0 }

export function P2PCockpit() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  const stages = listStages('p2p', code)
  const causes = listCauses('p2p')
  const ageing = getBlockedInvoiceAgeing(code ?? '')
  const service = getServiceControl()
  // §7.24 — committed spend by cost centre; the total ties to the PO stage in-flight figure above.
  const costCentres = listCostCentres(code ?? '')

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 2 — Process · Procure to Pay</Eyebrow>
          <h1 style={titleStyle}>Procure to pay</h1>
          {/* §8.7 — the whole flow is read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §8.3 — the process headline (AP blocked) shows direction of travel; ageing sub per §7.13 */}
        {entity && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <Metric label="AP blocked" value={formatCr(entity.metrics.apBlocked.current)} trend={entity.metrics.apBlocked} inverse={true} />
            <span style={{ fontSize: 12, color: colors.statusRed }}>{entityTileSubs(entity).apBlocked}</span>
          </div>
        )}
      </div>

      {/* §15.7 — the PO stage drills to the commitments watch (open POs by delivery date); every other stage keeps the worklist */}
      <StageFlow stages={stages} to={`/entity/${code}/p2p/invoices`} stageTo={{ PO: `/entity/${code}/p2p/commitments` }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.gapCards }}>
        <AgeingChart title="Blocked invoices by ageing" buckets={ageing} />

        <section style={{ ...cardStyle, gap: 14 }}>
          <Eyebrow style={typeScale.tableHeader}>Top causes — click to drill</Eyebrow>
          {causes.map((c) => (
            <Link
              key={c.key}
              to={`/entity/${code}/root-cause/p2p/${c.key}`}
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
              {/* §7.31 — per entity, not a group figure */}
              <span style={{ fontFamily: fonts.mono, color: colors.statusRed }}>{entity ? entity.metrics.queriesOverdue : '—'}</span>
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
            {entity ? `Open ${entity.metrics.apBlockedCount} blocked invoices →` : 'Open blocked invoices →'}
          </Link>
        </section>
      </div>

      {/* §7.24 — committed spend is the part most tools miss; each row drills to its cost centre page */}
      {costCentres.length > 0 && (
        <section style={{ ...cardStyle, gap: 12 }}>
          <Eyebrow style={typeScale.tableHeader}>Committed spend by cost centre</Eyebrow>
          {costCentres.map((cc) => (
            <Link
              key={cc.id}
              to={`/entity/${code}/cost-centre/${cc.id}`}
              className="fct-cause-row"
              style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: colors.textPrimary, textDecoration: 'none' }}
            >
              <span className="fct-cause-label" style={{ flex: 1 }}>{cc.name}</span>
              <span style={{ width: 90, flexShrink: 0 }}>
                <Bar value={cc.committedSpendCr} max={cc.budgetCr} color={colors.statusAmber} />
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 78, textAlign: 'right' }}>{formatCr(cc.committedSpendCr)}</span>
            </Link>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontSize: 12, color: colors.textMuted }}>
            <span>Open POs not yet invoiced</span>
            <span style={{ fontFamily: fonts.mono }}>{`${formatCr(costCentres.reduce((sum, cc) => sum + cc.committedSpendCr, 0))} committed`}</span>
          </div>
        </section>
      )}
    </div>
  )
}
