import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { agentPreventsLine, getEntity, listRequisitions, prCauses, requisitionAgents, requisitionPipeline } from '../api'
import type { PrChaseState, RequisitionRow } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, StatusDot, type Column } from '../components'
import { formatCr } from '../lib/format'
import { agentTypeColor } from '../theme/derive'
import { colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }

// §18.0 — a pipeline with ageing and chase state, not an exception queue; colours are the token status set only.
const STATE_STYLE: Record<PrChaseState, { label: string; color: string }> = {
  waiting: { label: 'WAITING', color: colors.textMuted },
  chased: { label: 'CHASED', color: colors.statusAmber },
  escalated: { label: 'ESCALATED', color: colors.statusRed },
}

function StateBadge({ state }: { state: PrChaseState }) {
  const s = STATE_STYLE[state]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: s.color }}>
      <StatusDot size={7} color={s.color} />
      {s.label}
    </span>
  )
}

export function Requisitions() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Requisitions</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  const pipeline = requisitionPipeline(entity.code)!
  const rows = listRequisitions(entity.code)
  const causes = prCauses()
  // §18.2 — the five requisition agents, in roster order; four of the five are preventive.
  const reqAgents = requisitionAgents()
  const budgetRows = rows.filter((r) => r.causeKey === 'budget')
  const budgetValueCr = Math.round(budgetRows.reduce((s, r) => s + r.valueCr, 0) * 100) / 100

  const columns: Array<Column<RequisitionRow>> = [
    { width: '130px', header: 'PR', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.id}</span> },
    {
      width: '280px', header: 'Why it is not converting',
      render: (r) => {
        const c = causes.find((x) => x.key === r.causeKey)!
        return (
          <span title={c.detail}>
            {c.name}
            <span style={{ color: colors.textFaint }}> — {c.detail}</span>
          </span>
        )
      },
    },
    { align: 'right', width: '100px', header: 'Value', render: (r) => <span style={{ fontFamily: fonts.mono }}>{formatCr(r.valueCr, 2)}</span> },
    { width: '80px', header: 'Age', render: (r) => <span style={{ fontFamily: fonts.mono }}>{`${r.ageDays} d`}</span> },
    { width: '150px', header: 'Owner', render: (r) => r.owner },
    { width: '130px', header: 'Chase state', render: (r) => <StateBadge state={r.chaseState} /> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 3 — Process · Requisitions</Eyebrow>
          <h1 style={titleStyle}>Requisitions</h1>
          {/* §8.7 — open PRs, their causes and owners are read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        <Link to={`/entity/${code}/p2p`} className="fct-link" style={{ padding: '10px 12px', fontSize: 13, color: colors.textSecondary, textDecoration: 'none' }}>
          ← Back to P2P cockpit
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 34, flexWrap: 'wrap' }} data-fct-pipeline data-prs={pipeline.prsInFlight} data-converted={pipeline.converted} data-unconverted={pipeline.unconverted}>
        {[
          { label: 'PRS IN FLIGHT', value: pipeline.prsInFlight.toLocaleString(), sub: 'open requisitions — the PR stage pool' },
          { label: 'CONVERTED TO PO', value: pipeline.converted.toLocaleString(), sub: 'now open as purchase orders' },
          { label: 'UNCONVERTED', value: String(pipeline.unconverted), red: true, sub: `${formatCr(pipeline.unconvertedValueCr)} not yet committed` },
        ].map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={{ ...typeScale.tileValue, color: m.red ? colors.statusRed : undefined }}>{m.value}</span>
            <span style={{ fontSize: 11, color: colors.textMuted }}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* §18.2 — the budget verdict is the Spend Control Tower's control; FCT reads it and owns the finance consequence */}
      <section data-fct-budget-panel style={{ ...cardStyle, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Budget exposure</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>source · Spend Control Tower</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: colors.textSecondary }}>
          {budgetRows.length} PRs · {formatCr(budgetValueCr, 2)} — no budget availability at the cost centre; chase with the cost centre owner to reallocate before conversion fails.
        </p>
      </section>

      {/* §18.1 — the PR-stage cause set, verbatim */}
      <section data-fct-pr-causes style={{ ...cardStyle, gap: 12 }}>
        <Eyebrow style={typeScale.tableHeader}>Why a PR is not converting</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {causes.map((c) => (
            <div key={c.key} data-fct-pr-cause={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textSecondary }}>{c.name.toUpperCase()}</span>
              <span style={{ ...typeScale.body, color: colors.textMuted }}>{c.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section data-fct-requisitions style={{ ...cardStyle, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Unconverted PRs</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${rows.length} rows · oldest first`}</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontSize: 12, color: colors.textMuted }}>
          <span>{`${formatCr(pipeline.unconvertedValueCr)} not yet committed — the PR stage pool minus the PO stage pool`}</span>
          <span style={{ fontFamily: fonts.mono }}>{`${rows.filter((r) => r.chaseState === 'chased').length} chased · ${rows.filter((r) => r.chaseState === 'escalated').length} escalated`}</span>
        </div>
      </section>

      {/* §18.2 — the five requisition agents; none creates a commitment, every one flags, proposes or chases */}
      <section data-fct-requisition-agents style={{ ...cardStyle, gap: 14 }}>
        <Eyebrow style={typeScale.tableHeader}>The five requisition agents</Eyebrow>
        {reqAgents.map((a) => (
          <div key={a.id} data-fct-req-agent={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textFaint }}>{`#${a.number}`}</span>
              <span style={{ ...typeScale.uiBase, fontWeight: fontWeights.semibold, color: colors.textPrimary }}>{a.name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${agentTypeColor(a.type)}`, padding: '1px 6px' }}>
                <StatusDot color={agentTypeColor(a.type)} size={5} />
                <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textSecondary }}>{a.type}</span>
              </span>
              <Link to={`/agents/${a.id}`} className="fct-link" style={{ marginLeft: 'auto', fontFamily: fonts.mono, fontSize: 10, color: colors.accentText, textDecoration: 'none' }}>record →</Link>
            </div>
            <p style={{ margin: 0, ...typeScale.body, color: colors.textSecondary }}>{a.scope}</p>
            <span style={{ fontFamily: fonts.mono, fontSize: 10 }}>
              <span style={{ letterSpacing: '0.08em', color: colors.textFaint }}>BOUNDED BY — </span>
              <span style={{ color: colors.textMuted }}>{a.boundedBy}</span>
            </span>
            {agentPreventsLine(a) && (
              <span style={{ fontFamily: fonts.mono, fontSize: 10 }}>
                <span style={{ letterSpacing: '0.08em', color: colors.textFaint }}>PREVENTS — </span>
                <span style={{ color: colors.statusGreen }}>{agentPreventsLine(a)}</span>
              </span>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
