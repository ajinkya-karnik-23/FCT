import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { attributionReason, exceptionTimeline, getCause, getEntity, getException } from '../api'
import type { TimelineEvent } from '../api'
import { Eyebrow, FreshnessStamp, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { ageColor, controlColor } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 20 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, display: 'flex', flexDirection: 'column' }
const fieldRow: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '12px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 13 }
const backLinkStyle: CSSProperties = { alignSelf: 'flex-start', padding: '8px 12px', fontSize: 12, textDecoration: 'none' }

export function ExceptionDetail() {
  const { code, exceptionId } = useParams()
  const x = getException(exceptionId ?? '')
  if (!x) return <UnknownException code={code} id={exceptionId ?? ''} />

  const entity = getEntity(code ?? '')
  const causeName = getCause(x.reasonKey)?.name ?? x.reasonKey

  // §7.6/§8.9 — the timeline is data-driven: seeded lifecycle + session action lines + today's status.
  const timeline = exceptionTimeline(x)
  const TONE_DOT: Record<TimelineEvent['tone'], string> = { ok: colors.statusGreen, bad: colors.statusRed, now: colors.accent }

  return (
    <div style={pageStyle}>
      <Link to={`/entity/${code}/p2p/invoices`} className="fct-link" style={backLinkStyle}>
        ← Back to worklist
      </Link>

      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 4 — Transaction</Eyebrow>
          <h1 style={titleStyle}>{x.vendor}</h1>
          {/* §8.7 — the transaction is read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
          <span style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted }}>{`${x.id} · ${x.po} · booked ${x.bookedOn}`}</span>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to={`/entity/${code}/root-cause/p2p/${x.reasonKey}`} className="fct-detail-btn" style={{ padding: '10px 16px', fontSize: 13, color: colors.textPrimary, textDecoration: 'none' }}>
            Why does this keep happening?
          </Link>
          <button type="button" className="fct-escalate-btn" onClick={() => {}} style={{ padding: '10px 16px', fontSize: 13, color: colors.textPrimary }}>
            Escalate to plant controller
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: spacing.gapCards }}>
        <section style={cardStyle}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
            <Eyebrow style={typeScale.tableHeader}>Transaction</Eyebrow>
          </div>
          <div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Entity</span>
              <span>{entity?.name ?? code}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Invoice value</span>
              <span style={{ fontFamily: fonts.mono }}>{formatCr(x.amount, 2)}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Ageing</span>
              <span style={{ fontFamily: fonts.mono, color: ageColor(x.ageDays) }}>{`${x.ageDays} days`}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Blocking reason</span>
              <span>{causeName}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Plant</span>
              <span>{x.plant}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Purchase order</span>
              <span style={{ fontFamily: fonts.mono }}>{x.po}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Responsible function</span>
              <span>P2P tower — invoice processing</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Owner</span>
              <span>{x.owner}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>SLA</span>
              <span style={{ fontFamily: fonts.mono, color: colors.statusRed }}>{`Breached by ${Math.max(1, x.ageDays - 15)} days`}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ color: colors.textMuted }}>Control significance</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: controlColor(x.controlSignificance) }}>{`${x.controlSignificance} — payables completeness`}</span>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCards }}>
          <section style={{ ...cardStyle, padding: 20, gap: 16 }}>
            <Eyebrow style={typeScale.tableHeader}>Lifecycle</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {timeline.map((r, i) => (
                <div key={`${i}-${r.text}`} style={{ display: 'grid', gridTemplateColumns: '90px 14px 1fr', columnGap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                    {r.dateLabel}
                    {r.time && <span style={{ fontSize: 10, color: colors.textFaint }}>{r.time}</span>}
                  </span>
                  <StatusDot size={8} color={TONE_DOT[r.tone]} />
                  {/* The open (last) row reads primary; completed rows read secondary. */}
                  <span style={{ fontSize: 13, color: i === timeline.length - 1 ? colors.textPrimary : colors.textSecondary }}>{r.text}</span>
                </div>
              ))}
            </div>
            {/* §7.6 — attribution and the reason for it sit with the lifecycle, not in a separate panel */}
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={typeScale.tableHeader}>{`Attribution — ${x.attribution}`}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{attributionReason(x.reasonKey)}</span>
            </div>
          </section>

          <section style={{ border: `1px solid ${colors.borderAccent}`, background: colors.bgAccentPanel, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow style={{ ...typeScale.tableHeader, color: colors.accentText }}>Next action</Eyebrow>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: colors.textSecondary }}>
              {`Goods receipt is pending at ${x.plant} stores. Auto-escalation to the plant controller fires in 6 hours; releasing this invoice clears ${formatCr(x.amount, 2)} of payment block.`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {['Chase GR', 'Assign owner', 'Log control exception'].map((label) => (
                <button key={label} type="button" className="fct-action-chip" onClick={() => {}} style={{ padding: '8px 12px', fontSize: 12 }}>
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function UnknownException({ code, id }: { code?: string; id: string }) {
  return (
    <div style={pageStyle}>
      <Eyebrow>Level 4 — Transaction</Eyebrow>
      <h1 style={titleStyle}>{`Unknown exception ${id}`}</h1>
      <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This invoice is not in the worklist.</p>
      <Link to={`/entity/${code ?? 'JGL'}/p2p/invoices`} className="fct-link" style={backLinkStyle}>
        ← Back to worklist
      </Link>
    </div>
  )
}
