import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { agentActions, agentRates, agentReversibility, agentWorkforceSummary, coverageStrip, getCounterparty, getException, getPurchaseOrder, listAgents, listRequests } from '../api'
import type { Agent, AgentAction, AgentMetrics, AgentProcess, AgentStatus, AgentType, CoverageStage } from '../api'
import { Eyebrow, Metric, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { agentTypeColor } from '../theme/derive'
import { colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }

// §15.1 — the label every agent surface carries; nothing more.
const SIMULATED = 'Simulated data'

type SortKey = 'default' | 'escalation' | 'override'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'default', label: 'DEFAULT' },
  { key: 'escalation', label: 'ESCALATION RATE' },
  { key: 'override', label: 'OVERRIDE RATE' },
]

const GROUPS: Array<{ key: AgentProcess; label: string }> = [
  { key: 'shared', label: 'Shared' },
  { key: 'p2p', label: 'P2P' },
  { key: 'o2c', label: 'O2C' },
]

// §15.8 — what must never be automated, verbatim; rendered prominently, not in a footnote.
const NEVER_AUTOMATE = [
  'Vendor bank detail changes',
  'Provisions requiring judgment',
  'Anything outside a stated tolerance',
  'Cut-off decisions at period end',
  'Novel cases with no precedent',
  'Statutory sign-off',
  'Credit release against exposure',
  'Anything an agent has already escalated twice',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

// The one-line summary of a delegation — used greyed on designed cards and in full in the record.
function delegationLine(a: Agent): string {
  const d = a.delegation
  const parts: string[] = []
  if (d.valueCapCr != null) parts.push(`value cap ${formatCr(d.valueCapCr)}`)
  if (d.toleranceBand) parts.push(`tolerance band · ${d.toleranceBand}`)
  if (d.requiresDualControl) parts.push('dual control')
  if (d.neverActsOn.length) parts.push(`never acts on ${d.neverActsOn.join(', ')}`)
  return parts.length ? parts.join(' · ') : 'no stated cap'
}

function SimTag() {
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.textMuted, border: `1px solid ${colors.borderDefault}`, padding: '2px 8px' }}>{SIMULATED}</span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>{label}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

function DashStat({ label }: { label: string }) {
  return (
    // §7.7 honest-absence pattern — a designed agent has no metrics yet; the dash says so without inventing a figure.
    <div title="Not built — no metrics yet" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>{label}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textFaint }}>—</span>
    </div>
  )
}

function TypeChip({ type }: { type: AgentType }) {
  const c = agentTypeColor(type)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${c}`, padding: '1px 6px' }}>
      <StatusDot color={c} size={5} />
      <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textSecondary }}>{type}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const live = status === 'live'
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: live ? colors.statusGreen : colors.textFaint, border: `1px solid ${live ? colors.statusGreen : colors.borderDefault}`, padding: '1px 6px' }}>{live ? 'Active' : 'Not active'}</span>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 10 }}>
      <span style={{ letterSpacing: '0.08em', color: colors.textFaint }}>{label} — </span>
      <span style={{ color: colors.textSecondary }}>{value}</span>
    </span>
  )
}

function AgentChip({ agent, note }: { agent: Agent; note?: string }) {
  const c = agentTypeColor(agent.type)
  return (
    <span title={`${agent.name} — ${agent.type}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${c}`, padding: '1px 5px' }}>
      <StatusDot color={c} size={5} />
      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary }}>{`#${agent.number}`}</span>
      {note && <span style={{ fontFamily: fonts.mono, fontSize: 8, color: colors.textFaint }}>{note}</span>}
    </span>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <StatusDot color={color} size={6} />
      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary }}>{label}</span>
    </span>
  )
}

function StripRow({ label, stages, byId }: { label: string; stages: CoverageStage[]; byId: Map<string, Agent> }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <span style={{ width: 36, flexShrink: 0, fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, paddingTop: 4 }}>{label}</span>
      {stages.map((stage) => (
        <div key={stage.code} data-fct-stage={stage.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>{stage.code}</span>
          {/* An empty chip area is the visible gap (DLV, DSP) — a client reads coverage and gaps in three seconds */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 20 }}>
            {stage.agents.map((id) => <AgentChip key={id} agent={byId.get(id)!} />)}
            {(stage.preClose ?? []).map((id) => <AgentChip key={`${id}-pre`} agent={byId.get(id)!} note="(pre-close)" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function MetricsStrip({ a, m }: { a: Agent; m: AgentMetrics }) {
  const rates = agentRates(a)
  const s = m.resolvedShareTrend
  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10 }}>
      <MiniStat label="ACTIONS THIS PERIOD" value={String(m.actionsThisPeriod)} />
      {s ? (
        <Metric label="RESOLVED SHARE" value={`${rates.resolvedSharePct}%`} trend={{ current: s[5], previous: s[4], series: s }} inverse={false} compact />
      ) : (
        <MiniStat label="RESOLVED SHARE" value={`${rates.resolvedSharePct}%`} />
      )}
      <MiniStat label="ESCALATION RATE" value={`${rates.escalationPct}%`} />
      <MiniStat label="OVERRIDE RATE" value={`${rates.overridePct}%`} />
    </div>
  )
}

function DesignedRow({ a }: { a: Agent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10 }}>
      {/* the delegation it WOULD hold, greyed — specified but not built */}
      <span title="Designed — this is the delegation it would hold" style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{`WOULD HOLD · ${delegationLine(a)}`}</span>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <DashStat label="ACTIONS THIS PERIOD" />
        <DashStat label="RESOLVED SHARE" />
        <DashStat label="ESCALATION RATE" />
        <DashStat label="OVERRIDE RATE" />
      </div>
    </div>
  )
}

const OUTCOME_COLOR: Record<AgentAction['outcome'], string> = {
  resolved: colors.statusGreen,
  escalated: colors.statusAmber,
  awaiting: colors.textMuted,
  reversed: colors.statusRed,
  overridden: colors.statusRed,
}

function OutcomeTag({ outcome }: { outcome: AgentAction['outcome'] }) {
  // The record sits on bgRaised, where light-theme statusAmber misses AA — escalated takes the amber-tinted surface that clears it (§7.10.1).
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: OUTCOME_COLOR[outcome], ...(outcome === 'escalated' ? { background: colors.bgWarnSoft, padding: '1px 5px' } : {}) }}>{outcome}</span>
  )
}

// Every action-log target resolves to a real, openable route (§15.2.1 — precedent must be readable).
function targetLink(act: AgentAction): { to: string; label: string } | null {
  if (act.targetType === 'exception') return { to: `/entity/${act.entityCode}/p2p/invoices/${act.targetId}`, label: 'open item →' }
  if (act.targetType === 'request') return { to: '/service-desk', label: 'open request →' }
  if (act.targetType === 'creditBlock') return { to: `/entity/${act.entityCode}/customer/${act.targetId}`, label: 'open customer →' }
  // §15.7 — a PO-stage engagement opens the PO detail page, where the agent–owner exchange lives.
  if (act.targetType === 'po') return { to: `/entity/${act.entityCode}/p2p/commitments/${act.targetId}`, label: 'open PO →' }
  return null
}

// §15.2.1 — a cited precedent must be readable too: exception ids open the invoice, request ids the desk, counterparty ids their page, PO ids the PO detail.
function precedentLink(pid: string): string | null {
  const ex = getException(pid)
  if (ex) return `/entity/${ex.entityCode}/p2p/invoices/${pid}`
  if (listRequests().some((r) => r.id === pid)) return '/service-desk'
  const po = getPurchaseOrder(pid)
  if (po) return `/entity/${po.entityCode}/p2p/commitments/${pid}`
  const cp = getCounterparty(pid)
  if (!cp) return null
  return cp.type === 'customer' ? `/entity/${cp.entityCode}/customer/${pid}` : `/entity/${cp.entityCode}/vendor/${pid}`
}

function ActionRow({ act }: { act: AgentAction }) {
  const target = targetLink(act)
  return (
    <div data-fct-action={act.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0', borderTop: `1px solid ${colors.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{formatDay(act.takenAt)}</span>
        <OutcomeTag outcome={act.outcome} />
        {target && (
          <Link to={target.to} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.accentText, textDecoration: 'none' }}>{target.label}</Link>
        )}
      </div>
      <p style={{ ...typeScale.body, color: colors.textPrimary, margin: 0 }}>{act.action}</p>
      <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`why — ${act.rationale}`}</p>
      {act.precedents.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>PRECEDENTS</span>
          {act.precedents.map((pid) => {
            const to = precedentLink(pid)
            return to ? (
              <Link key={pid} to={to} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.accentText, textDecoration: 'none' }}>{pid}</Link>
            ) : (
              <span key={pid} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{pid}</span>
            )
          })}
        </div>
      )}
      {act.evidence.length > 0 && (
        <p style={{ ...typeScale.body, color: colors.textMuted, margin: 0 }}>{`evidence — ${act.evidence.join('; ')}`}</p>
      )}
      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{`${act.reversible ? 'reversible' : 'not reversible'} · within delegation`}</span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.body, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

function ListLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint, width: 130, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <ul style={{ margin: 0, paddingLeft: 16, flex: 1, ...typeScale.body, color: colors.textSecondary }}>
        {items.map((it) => <li key={it}>{it}</li>)}
      </ul>
    </div>
  )
}

export function AgentRecord({ a }: { a: Agent }) {
  const actions = agentActions(a.id)
  const m = a.metrics
  const s = m?.resolvedShareTrend
  return (
    <div data-fct-record={a.id} style={{ borderTop: `1px solid ${colors.borderDefault}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: colors.bgRaised }}>
      {/* §15.1 — the record is an agent surface too; the honesty label repeats here */}
      <SimTag />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Delegation of authority</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(a.advisoryOnly || a.proposesOnly) && (
            <Field label="AUTHORITY" value={a.proposesOnly ? 'proposes only' : 'advisory'} />
          )}
          <Field label="VALUE CAP" value={a.delegation.valueCapCr != null ? formatCr(a.delegation.valueCapCr) : '—'} />
          <Field label="TOLERANCE BAND" value={a.delegation.toleranceBand ?? '—'} />
          <Field label="DUAL CONTROL" value={a.delegation.requiresDualControl ? 'required' : 'not required'} />
          <Field label="SUPERVISED BY" value={a.supervisor} />
        </div>
        {a.delegation.neverActsOn.length > 0 && <ListLine label="NEVER ACTS ON" items={a.delegation.neverActsOn} />}
        {a.delegation.escalatesWhen.length > 0 && <ListLine label="ESCALATES WHEN" items={a.delegation.escalatesWhen} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Performance over time</Eyebrow>
        {m && s ? (
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <Metric label="RESOLVED SHARE" value={`${agentRates(a).resolvedSharePct}%`} trend={{ current: s[5], previous: s[4], series: s }} inverse={false} />
            <MiniStat label="ACTIONS THIS PERIOD" value={String(m.actionsThisPeriod)} />
            <MiniStat label="ESCALATED" value={String(m.escalated)} />
            <MiniStat label="OVERRIDDEN" value={String(m.overriddenByHuman)} />
            <MiniStat label="REVERSED" value={String(m.reversed)} />
          </div>
        ) : (
          <span title="Not built — no performance record yet" style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>— not built; no performance record</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Action log</Eyebrow>
        {actions.length === 0 ? (
          <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>No action log yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {actions.map((act) => <ActionRow key={act.id} act={act} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function AgentCard({ a, expanded, onToggle }: { a: Agent; expanded: boolean; onToggle: () => void }) {
  const live = a.status === 'live'
  return (
    <div data-fct-agent={a.id} style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, display: 'flex', flexDirection: 'column' }}>
      <div onClick={onToggle} role="button" tabIndex={0} data-fct-agent-toggle={a.id} style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textFaint }}>{`#${a.number}`}</span>
          <span style={{ ...typeScale.uiBase, fontWeight: fontWeights.semibold, color: colors.textPrimary }}>{a.name}</span>
          <TypeChip type={a.type} />
          <StatusBadge status={a.status} />
        </div>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{a.scope}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Meta label="BOUNDED BY" value={a.boundedBy} />
          <Meta label="SUPERVISED BY" value={`${a.supervisor} · ${agentReversibility(a)}`} />
          {/* §15.7 — the per-agent drill into that agent's own record */}
          <Link to={`/agents/${a.id}`} data-fct-agent-link={a.id} onClick={(e) => e.stopPropagation()} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.accentText, textDecoration: 'none' }}>{'record →'}</Link>
        </div>
        {live && a.metrics ? <MetricsStrip a={a} m={a.metrics} /> : <DesignedRow a={a} />}
      </div>
      {expanded && <AgentRecord a={a} />}
    </div>
  )
}

export function Agents() {
  const agents = listAgents()
  const byId = new Map(agents.map((a) => [a.id, a]))
  const summary = agentWorkforceSummary()
  const strip = coverageStrip()
  const [sort, setSort] = useState<SortKey>('default')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Default order is roster number. When sorted by a rate, live agents rank descending within their type section and
  // designed agents (no metrics) sink to the bottom — that ordering is how a mis-set delegation gets found (§15.5.1).
  function sortWithin(list: Agent[]): Agent[] {
    if (sort === 'default') return [...list].sort((x, y) => x.number - y.number)
    const rate = (a: Agent) => agentRates(a)[sort === 'escalation' ? 'escalationPct' : 'overridePct'] ?? -1
    return [...list].sort((x, y) => {
      if (x.status !== y.status) return x.status === 'live' ? -1 : 1
      if (x.status === 'designed') return x.number - y.number
      return rate(y) - rate(x)
    })
  }

  function groupAgents(key: AgentProcess): Array<{ type: AgentType; agents: Agent[] }> {
    const inGroup = agents.filter((a) => a.process === key)
    // preventive before reactive within each process (§15.2.1); empty sections are dropped (Shared has none).
    return [
      { type: 'preventive' as AgentType, agents: sortWithin(inGroup.filter((a) => a.type === 'preventive')) },
      { type: 'reactive' as AgentType, agents: sortWithin(inGroup.filter((a) => a.type === 'reactive')) },
    ].filter((g) => g.agents.length > 0)
  }

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Agents</Eyebrow>
        <h1 style={titleStyle}>The agent workforce</h1>
        {/* §15.1 — every agent surface carries the honesty label */}
        <SimTag />
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`${summary.totalRoles} roles · ${summary.liveRoles} active`}</p>
      </div>

      {/* §15.5.1 layer 1 — workforce summary, computed at read time (never stored) */}
      <section data-fct-summary style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Workforce</Eyebrow>
          {/* §15.1.1 — spec-pinned cycle times; agents have already run, there is no run button */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>agents last ran 06:42 · next cycle 07:00</span>
        </div>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
          <Stat label="ACTIVE ROLES" value={`${summary.liveRoles} of ${summary.totalRoles}`} />
          <Stat label="ACTIONS THIS PERIOD" value={String(summary.actionsThisPeriod)} />
          <Stat label="RESOLVED WITHOUT HUMAN" value={String(summary.resolvedWithoutHuman)} />
          <Stat label="ESCALATED" value={String(summary.escalated)} />
          <Stat label="OVERRIDDEN" value={String(summary.overriddenByHuman)} />
          <Stat label="REVERSED" value={String(summary.reversed)} />
          <Stat label="PREVENTIVE" value={`${summary.preventive} of ${summary.totalRoles}`} />
        </div>
      </section>

      {/* §15.2.0 layer 2 — the lifecycle coverage strip: stages across, agents positioned where they act */}
      <section data-fct-coverage style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Lifecycle coverage</Eyebrow>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <LegendDot color={agentTypeColor('preventive')} label="preventive" />
          <LegendDot color={agentTypeColor('reactive')} label="reactive" />
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>+ 1, 2 across all stages</span>
        </div>
        <StripRow label="P2P" stages={strip.p2p} byId={byId} />
        <StripRow label="O2C" stages={strip.o2c} byId={byId} />
        {/* §15.2.1 — R2R is deliberately absent from the strip; named here as roadmap, not shown as empty */}
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>Record to report — in the roadmap</p>
      </section>

      {/* §15.5.1 layer 3 — the agent list, grouped Shared / P2P / O2C, preventive before reactive within each */}
      <section data-fct-roster style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Eyebrow style={typeScale.tableHeader}>The roster</Eyebrow>
          {/* sortable by escalation and override rate — that is how a mis-set delegation gets found */}
          <div style={{ display: 'flex', gap: 8 }}>
            {SORTS.map((s) => (
              <button key={s.key} data-fct-sort={s.key} onClick={() => setSort(s.key)} style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', background: sort === s.key ? colors.bgSelected : 'transparent', color: sort === s.key ? colors.textPrimary : colors.textMuted, border: `1px solid ${sort === s.key ? colors.borderAccent : colors.borderDefault}`, padding: '4px 10px' }}>{s.label}</button>
            ))}
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.14em', color: colors.textMuted }}>{g.label.toUpperCase()}</span>
            {groupAgents(g.key).map((sub) => (
              <div key={sub.type} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{sub.type.toUpperCase()}</span>
                {sub.agents.map((a) => (
                  <AgentCard key={a.id} a={a} expanded={expandedId === a.id} onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* §15.8 — what must never be automated, rendered prominently rather than in a footnote */}
      <section data-fct-never style={cardStyle}>
        <Eyebrow style={typeScale.tableHeader}>What must never be automated</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {NEVER_AUTOMATE.map((item) => (
            <div key={item} data-fct-never-item={item.toLowerCase().replace(/\s+/g, '-')} style={{ background: colors.bgRiskSoft, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot color={colors.statusRed} size={6} />
              <span style={{ ...typeScale.body, color: colors.textPrimary }}>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
