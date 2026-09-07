import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAgent, getEntity, getPurchaseOrder, listCostCentres, poDaysOut, poDecisionFor } from '../api'
import type { PurchaseOrder } from '../api'
import { Eyebrow, FreshnessStamp, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'
import { AgentDecision } from './ExceptionDetail'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 20 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, display: 'flex', flexDirection: 'column' }
const fieldRow: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '12px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 13 }
const backLinkStyle: CSSProperties = { alignSelf: 'flex-start', padding: '8px 12px', fontSize: 12, textDecoration: 'none' }

// Local date labels (same shape as ExceptionDetail's) — the api surface does not export a formatter.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
const timeOf = (iso: string) => iso.slice(11, 16)

// §15.7 — the agent–owner exchange as a timeline reusing the exception-detail lifecycle grammar (90px date column,
// tone dot), with actor tags so agent and human rows read apart (§15.7: visually distinct).
interface ExchangeEvent {
  dateLabel: string
  time?: string
  text: string
  actor: 'agent' | 'owner' | 'system'
  tone: 'ok' | 'bad' | 'now' | 'neutral'
}

function exchangeTimeline(po: PurchaseOrder, supervisorName: string): ExchangeEvent[] {
  const ex = po.exchange!
  const events: ExchangeEvent[] = [
    { dateLabel: formatDay(ex.askedAt), time: timeOf(ex.askedAt), text: `Asked ${po.ownerName} to flag slippage — “${ex.askText}”`, actor: 'agent', tone: 'neutral' },
  ]
  if (po.chaseState === 'chased') {
    events.push({ dateLabel: formatDay(ex.askedAt), text: `Awaiting ${po.ownerName}’s reply — no decision yet`, actor: 'system', tone: 'now' })
    return events
  }

  const r = ex.reply!
  events.push({ dateLabel: formatDay(r.at), time: timeOf(r.at), text: `“${r.text}”`, actor: 'owner', tone: 'ok' })

  if (po.chaseState === 'amended') {
    events.push(
      { dateLabel: formatDay(ex.understoodAt!), time: timeOf(ex.understoodAt!), text: `Understood: delivery moves to ${formatDay(ex.extractedDate!)} — confidence ${ex.confidence!.toFixed(2)}`, actor: 'agent', tone: 'neutral' },
      { dateLabel: formatDay(ex.amendment!.postedAt!), time: timeOf(ex.amendment!.postedAt!), text: `Amended the delivery date ${formatDay(ex.amendment!.from)} → ${formatDay(ex.amendment!.to)} — date only`, actor: 'agent', tone: 'ok' },
      { dateLabel: formatDay(ex.notifiedAt!), time: timeOf(ex.notifiedAt!), text: `Notified ${po.ownerName}: “${ex.notificationText}”`, actor: 'agent', tone: 'neutral' },
    )
  } else {
    events.push(
      { dateLabel: formatDay(ex.understoodAt!), time: timeOf(ex.understoodAt!), text: `Understood (uncertain): delivery may move to ~${formatDay(ex.extractedDate!)} — confidence ${ex.confidence!.toFixed(2)}, below the threshold`, actor: 'agent', tone: 'bad' },
      { dateLabel: formatDay(ex.proposedAt!), time: timeOf(ex.proposedAt!), text: `Proposed ${formatDay(ex.amendment!.to)} and escalated to ${supervisorName} — no change made`, actor: 'agent', tone: 'bad' },
    )
  }
  return events
}

const TONE_DOT: Record<ExchangeEvent['tone'], string> = { ok: colors.statusGreen, bad: colors.statusRed, now: colors.accent, neutral: colors.textFaint }
const ACTOR_TAG: Record<Exclude<ExchangeEvent['actor'], 'system'>, { label: string; color: string }> = {
  agent: { label: 'AGENT', color: colors.accentText },
  owner: { label: 'OWNER', color: colors.statusGreen },
}

const STATE_BADGE: Record<PurchaseOrder['chaseState'], { label: string; color: string }> = {
  'on-track': { label: 'ON TRACK', color: colors.textMuted },
  chased: { label: 'CHASED — AWAITING REPLY', color: colors.statusAmber },
  amended: { label: 'AMENDED · POSTED', color: colors.statusGreen },
  proposed: { label: 'PROPOSED · ESCALATED', color: colors.statusRed },
}

export function PoDetail() {
  const { code, poId } = useParams()
  const entity = getEntity(code ?? '')
  const po = getPurchaseOrder(poId ?? '')
  if (!entity || !po) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Purchase order</Eyebrow>
        <h1 style={titleStyle}>{`Unknown PO ${poId}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This purchase order is not in the entity's open commitments.</p>
        <Link to={`/entity/${code ?? 'JGL'}/p2p/commitments`} className="fct-link" style={backLinkStyle}>
          ← Back to commitments watch
        </Link>
      </div>
    )
  }

  const centre = listCostCentres(entity.code).find((c) => c.id === po.costCentreId)
  const agent = getAgent('commitments')!
  const record = poDecisionFor(po.id)
  const events = po.exchange ? exchangeTimeline(po, agent.supervisor) : []
  const badge = STATE_BADGE[po.chaseState]

  return (
    <div style={pageStyle}>
      <Link to={`/entity/${code}/p2p/commitments`} className="fct-link" style={backLinkStyle}>
        ← Back to commitments watch
      </Link>

      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 4 — Transaction · Purchase order</Eyebrow>
          <h1 style={titleStyle}>{po.id}</h1>
          {/* §8.7 — the PO and its delivery date are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
          <span style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted }}>{`${po.vendorName} · ${centre?.name ?? po.costCentreId}`}</span>
        </div>
        {/* The SAP state the controller asks about on the phone — and what the exchange below may or may not have changed */}
        <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', padding: '3px 6px', border: `1px solid ${badge.color}`, color: badge.color }}>{badge.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: spacing.gapCards }}>
        <section data-fct-po-detail={po.id} style={cardStyle}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
            <Eyebrow style={typeScale.tableHeader}>Purchase order</Eyebrow>
          </div>
          <div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Entity</span>
              <span>{entity.name}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Vendor</span>
              <span>{po.vendorName}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Cost centre</span>
              <Link to={`/entity/${code}/cost-centre/${po.costCentreId}`} className="fct-link" style={{ color: colors.accentText, textDecoration: 'none' }}>{centre?.name ?? po.costCentreId}</Link>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Value</span>
              <span style={{ fontFamily: fonts.mono }}>{formatCr(po.valueCr)}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Delivery date</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontFamily: fonts.mono }}>{formatDay(po.deliveryDate)}</span>
                {po.chaseState === 'amended' && (
                  <span style={{ fontSize: 11, color: colors.statusGreen }}>{`was ${formatDay(po.originalDeliveryDate!)} — amended`}</span>
                )}
                {po.chaseState === 'proposed' && (
                  <span style={{ fontSize: 11, color: colors.statusRed }}>proposal pending — no change made</span>
                )}
              </span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Days to delivery</span>
              <span style={{ fontFamily: fonts.mono }}>{`${poDaysOut(po)} days`}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>PO owner</span>
              <span>{po.ownerName}</span>
            </div>
          </div>
        </section>

        <section data-fct-po-exchange style={{ ...cardStyle, padding: 20, gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Agent–owner exchange</Eyebrow>
          {events.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {events.map((e, i) => (
                <div key={`${i}-${e.text}`} style={{ display: 'grid', gridTemplateColumns: '90px 14px 1fr', columnGap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                    {e.dateLabel}
                    {e.time && <span style={{ fontSize: 10, color: colors.textFaint }}>{e.time}</span>}
                  </span>
                  <StatusDot size={8} color={TONE_DOT[e.tone]} />
                  {/* The open (last) row reads primary; completed rows read secondary. */}
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, color: i === events.length - 1 ? colors.textPrimary : colors.textSecondary }}>
                    {e.actor !== 'system' && (
                      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: ACTOR_TAG[e.actor].color }}>{ACTOR_TAG[e.actor].label}</span>
                    )}
                    {e.text}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>No agent activity — the delivery date stands as released.</p>
          )}
        </section>
      </div>

      {/* §15.2.1 — what the agent understood (quoted reply, extracted intent, confidence) and what it declined */}
      <AgentDecision record={record} fallback="No agent activity yet — the delivery date stands as released." />
    </div>
  )
}
