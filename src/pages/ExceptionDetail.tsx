import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { attributionReason, decisionOverridden, decisionRecordFor, exceptionTimeline, exceptionWalkthrough, getCause, getCounterparty, getEntity, getException, laneForException, overrideDecision } from '../api'
import type { Agent, AgentAction, TimelineEvent, WalkthroughStep } from '../api'
import { Eyebrow, FreshnessStamp, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { ageColor, controlColor } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 0, gap: 0 }
const fieldRow: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '12px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 13 }
const backLinkStyle: CSSProperties = { alignSelf: 'flex-start', padding: '8px 12px', fontSize: 12, textDecoration: 'none' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function ExceptionDetail() {
  const { code, exceptionId } = useParams()
  const x = getException(exceptionId ?? '')
  if (!x) return <UnknownException code={code} id={exceptionId ?? ''} />

  const entity = getEntity(code ?? '')
  const causeName = getCause(x.reasonKey)?.name ?? x.reasonKey

  // §7.6/§8.9 — the timeline is data-driven: seeded lifecycle + session action lines + today's status.
  const timeline = exceptionTimeline(x)
  // Step 22 — only the row that carries the full arc (nudge → escalation → reversing accrual) gets the walkthrough.
  const walkthrough = exceptionWalkthrough(x)
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
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
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

          <section style={{ ...clay.cardAccent, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
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

      {/* Step 22 — the demo beat as a stepped walkthrough: one step at a time, advanced by hand. Stepped, not animated (§15.1.2). */}
      {walkthrough && <Walkthrough steps={walkthrough} />}

      {/* §15.1.2 — the decision record sits with the transaction: what set the agent on it, each check openable, and what it declined */}
      <AgentDecision record={decisionRecordFor(x.id)} fallback={laneForException(x).detail} />
    </div>
  )
}

// Step 22 — one step of the walkthrough at a time. Agent rows carry an accent dot and an AGENT tag; system rows stay
// neutral (§15.7 — agent actions visually distinct from human ones). No auto-advance, no animation.
function Walkthrough({ steps }: { steps: WalkthroughStep[] }) {
  const [step, setStep] = useState(0)
  const s = steps[step]
  return (
    <section data-fct-walkthrough style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '14px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
        <Eyebrow style={typeScale.tableHeader}>Walkthrough</Eyebrow>
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`Step ${step + 1} of ${steps.length}`}</span>
      </div>

      <div data-fct-step={step + 1} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={typeScale.tableHeader}>{s.title}</span>
        {s.caption && (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: colors.textSecondary }}>{s.caption}</p>
        )}
        {s.events?.map((e, i) => (
          <div key={`${i}-${e.text}`} style={{ display: 'grid', gridTemplateColumns: '90px 14px 1fr', columnGap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{e.dateLabel ?? ''}</span>
            <StatusDot size={8} color={e.actor === 'agent' ? colors.accent : colors.textFaint} />
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, color: e.actor === 'agent' ? colors.textPrimary : colors.textSecondary }}>
              {e.actor === 'agent' && (
                <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.accentText }}>AGENT</span>
              )}
              {e.text}
            </span>
          </div>
        ))}
        {s.supervision && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/agents/provisioning" className="fct-link" style={{ fontSize: 13, color: colors.accentText, textDecoration: 'none' }}>Agent action log →</Link>
            <Link to="/risk-control" className="fct-link" style={{ fontSize: 13, color: colors.accentText, textDecoration: 'none' }}>Audit sampling →</Link>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: `1px solid ${colors.borderSubtle}` }}>
        <button type="button" data-fct-wt-next className="fct-action-chip" onClick={() => setStep((n) => Math.min(n + 1, steps.length - 1))} disabled={step === steps.length - 1} style={{ padding: '8px 12px', fontSize: 12, opacity: step === steps.length - 1 ? 0.5 : 1 }}>
          Next step
        </button>
        <button type="button" data-fct-wt-reset className="fct-action-chip" onClick={() => setStep(0)} style={{ padding: '8px 12px', fontSize: 12 }}>
          Start over
        </button>
      </div>
    </section>
  )
}

// §15.2.1 — a precedent must be readable: exception ids open the invoice, counterparty ids open their page, anything else stays plain text.
function PrecedentLink({ pid }: { pid: string }) {
  const ex = getException(pid)
  if (ex) return <PidLink to={`/entity/${ex.entityCode}/p2p/invoices/${pid}`} pid={pid} />
  const cp = getCounterparty(pid)
  if (cp) return <PidLink to={cp.type === 'customer' ? `/entity/${cp.entityCode}/customer/${pid}` : `/entity/${cp.entityCode}/vendor/${pid}`} pid={pid} />
  return <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{pid}</span>
}

function PidLink({ to, pid }: { to: string; pid: string }) {
  return (
    <Link to={to} style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>
      {pid}
    </Link>
  )
}

// §15.1.2 — the decision record: trigger, checks (each openable), precedents, delegation, action, declined, reversibility.
// No animation of agent reasoning — the two controls are a step-through for demo and the human's override exit (§15.6).
export function AgentDecision({ record, fallback }: { record?: { action: AgentAction; agent: Agent }; fallback?: string }) {
  const [step, setStep] = useState<number | null>(null) // null = all checks shown; n = first n only
  const [openCheck, setOpenCheck] = useState<number | null>(null)
  const [, setVersion] = useState(0) // bump after the override store mutation

  if (!record) {
    return (
      <section style={cardStyle}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
          <Eyebrow style={typeScale.tableHeader}>Agent decision record</Eyebrow>
        </div>
        {fallback && (
          <div style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: 13, color: colors.textMuted }}>{fallback}</span>
          </div>
        )}
      </section>
    )
  }

  const { action, agent } = record
  const checks = action.checks ?? []
  const overridden = decisionOverridden(action.id)
  const visibleChecks = step === null ? checks : checks.slice(0, step)

  const delegation: Array<[string, string]> = []
  if (agent.delegation.valueCapCr != null) delegation.push(['Value cap', formatCr(agent.delegation.valueCapCr)])
  if (agent.delegation.toleranceBand) delegation.push(['Tolerance band', agent.delegation.toleranceBand])
  delegation.push(['Dual control', agent.delegation.requiresDualControl ? 'required' : 'not required'])
  if (agent.delegation.neverActsOn.length) delegation.push(['Never acts on', agent.delegation.neverActsOn.join(', ')])
  if (agent.delegation.escalatesWhen.length) delegation.push(['Escalates when', agent.delegation.escalatesWhen.join('; ')])

  return (
    <section data-fct-decision={action.id} style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '14px 20px', borderBottom: `1px solid ${colors.borderDefault}` }}>
        <Eyebrow style={typeScale.tableHeader}>Agent decision record</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {overridden && (
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.statusRed, border: `1px solid ${colors.statusRed}`, padding: '2px 8px' }}>OVERRIDDEN BY HUMAN</span>
          )}
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${agent.name} · ${formatDay(action.takenAt)}`}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '14px 20px' }}>
        <button type="button" className="fct-action-chip" onClick={() => setStep(step === null ? 1 : step >= checks.length ? null : step + 1)} style={{ padding: '8px 12px', fontSize: 12 }}>
          {step === null ? 'Step through this decision' : step < checks.length ? `Next check (${step + 1}/${checks.length})` : 'Show all'}
        </button>
        {/* §15.6 — the override is the human's exit; it feeds the agent's overridden-by-human rate */}
        <button type="button" className="fct-action-chip" onClick={() => { overrideDecision(action.id); setVersion((v) => v + 1) }} disabled={overridden} style={{ padding: '8px 12px', fontSize: 12, opacity: overridden ? 0.5 : 1 }}>
          {overridden ? 'Overridden by human' : 'Override'}
        </button>
      </div>

      <div style={fieldRow}>
        <span style={{ color: colors.textMuted }}>Trigger</span>
        <span>{action.trigger}</span>
      </div>

      {checks.length > 0 && (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <span style={typeScale.tableHeader}>Checks</span>
          {visibleChecks.map((c, i) => (
            <div key={`${i}-${c.test}`} style={{ border: `1px solid ${colors.borderSubtle}` }}>
              {/* Bare button — index.css resets font/color only, so background and border are set inline */}
              <button type="button" onClick={() => setOpenCheck(openCheck === i ? null : i)} style={{ display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '8px 12px', fontSize: 13, textAlign: 'left', background: 'transparent', border: 'none' }}>
                <span>{c.test}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 11, color: c.pass ? colors.statusGreen : colors.statusRed }}>{c.pass ? 'PASS' : 'FAIL'}</span>
              </button>
              {openCheck === i && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 10px' }}>
                  <div style={{ fontSize: 12 }}><span style={{ color: colors.textMuted }}>Threshold </span><span style={{ fontFamily: fonts.mono }}>{c.threshold}</span></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: colors.textMuted }}>Actual </span><span style={{ fontFamily: fonts.mono }}>{c.actual}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={fieldRow}>
        <span style={{ color: colors.textMuted }}>Precedents</span>
        <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{action.precedents.map((pid) => <PrecedentLink key={pid} pid={pid} />)}</span>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <span style={typeScale.tableHeader}>Delegation</span>
        {delegation.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
            <span style={{ color: colors.textMuted }}>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <span style={typeScale.tableHeader}>Action</span>
        <span style={{ fontSize: 13 }}>{action.action}</span>
      </div>

      {action.declined && (
        // The declined line matters more than the action line — it is what the agent deliberately did not do, and why.
        <div style={{ padding: '12px 20px', paddingLeft: 14, borderLeft: `2px solid ${colors.accent}`, display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <span style={typeScale.tableHeader}>Declined</span>
          <span style={{ fontSize: 13, color: colors.textPrimary }}>{action.declined}</span>
        </div>
      )}

      {action.reversibility && (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={typeScale.tableHeader}>Reversibility</span>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{action.reversibility}</span>
        </div>
      )}
    </section>
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
