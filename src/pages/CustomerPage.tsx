import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { creditBlockDecisionFor, getEntity, listCounterparties } from '../api'
import { AgeingChart, Eyebrow, FreshnessStamp } from '../components'
import { AgentDecision } from './ExceptionDetail'
import { formatCr } from '../lib/format'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }
const cardStyle: CSSProperties = { ...clay.card, padding: 20, gap: 14 }

export function CustomerPage() {
  const { code, id } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Customer</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const customer = listCounterparties(entity.code, 'customer').find((c) => c.id === id)
  if (!customer) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Customer</Eyebrow>
        <h1 style={titleStyle}>{`Unknown customer ${id}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This customer is not in the entity's forecast drivers.</p>
        <Link to={`/entity/${code}/o2c`} className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to O2C cockpit
        </Link>
      </div>
    )
  }

  const metrics = [
    { label: 'EXPOSURE', value: formatCr(customer.exposureCr ?? 0) },
    { label: 'DISPUTES & DEDUCTIONS', value: formatCr(customer.disputesCr) },
  ]

  // Step 22 — O2C beat: the credit agent's handling of this block, same decision-record shape as P2P.
  const blockDecision = customer.creditBlocked ? creditBlockDecisionFor(customer.id) : undefined

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 5 — Counterparty · Customer</Eyebrow>
          <h1 style={titleStyle}>{customer.name}</h1>
          {/* §8.7 — the customer's items are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.24 — credit block status is the state a controller asks about on the phone */}
        <span
          style={clay.tag(customer.creditBlocked ? colors.statusRed : colors.statusGreen)}
        >
          {customer.creditBlocked ? 'CREDIT BLOCKED' : 'OPEN'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 34 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={typeScale.tileValue}>{m.value}</span>
          </div>
        ))}
      </div>

      <AgeingChart title="Receivables by age" buckets={customer.ageingBuckets} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.gapCards }}>
        <section style={cardStyle}>
          <Eyebrow style={typeScale.tableHeader}>Payment behaviour</Eyebrow>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: colors.textSecondary, margin: 0 }}>{customer.paymentBehaviour}</p>
        </section>

        <section style={{ ...cardStyle, background: customer.creditBlocked ? colors.bgRiskSoft : colors.bgPanel }}>
          <Eyebrow style={typeScale.tableHeader}>Credit block &amp; release path</Eyebrow>
          {customer.creditBlocked && customer.releasePath ? (
            <p style={{ fontSize: 13, lineHeight: 1.55, color: colors.textSecondary, margin: 0 }}>{customer.releasePath}</p>
          ) : (
            <p style={{ fontSize: 13, color: colors.textMuted, margin: 0 }}>No credit block.</p>
          )}
        </section>
      </div>

      {/* Step 22 — O2C beat: how the credit agent handled this block; only customers with a logged decision get it. */}
      {blockDecision && <AgentDecision record={blockDecision} />}
    </div>
  )
}
