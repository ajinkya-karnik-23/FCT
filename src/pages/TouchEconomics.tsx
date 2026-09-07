import type { CSSProperties } from 'react'
import { Fragment } from 'react'
import { getEntity, getTouchLeverStages, listCauses, listTouchFunnel } from '../api'
import type { CauseNode, TouchFunnelRow } from '../api'
import { DataTable, Eyebrow, type Column } from '../components'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }

// §15.1 — the label every agent surface carries; nothing more.
const SIMULATED = 'Simulated data'

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

// §15.3 — the two levers, named for what each one does between stages; they compound and cost differently.
const LEVER_LABELS = ['fewer exceptions arising', 'agents on the residue']
const STAGE_SLUGS = ['today', 'after-cause-elimination', 'effective-agents']

export function TouchEconomics() {
  const funnel = listTouchFunnel()
  const jgl = funnel.find((r) => r.code === 'JGL')!
  // §15.3 — only JGL carries the illustrative glide path; no other entity has lever-stage figures.
  const stages = getTouchLeverStages('JGL')!
  const causes: CauseNode[] = listCauses('p2p')

  const funnelColumns: Array<Column<TouchFunnelRow>> = [
    { width: '200px', header: 'Entity', render: (r) => <span style={{ color: colors.textPrimary }}>{getEntity(r.code)?.name ?? r.code}</span> },
    { width: '110px', align: 'right', header: 'Touchless %', render: (r) => <span style={{ fontFamily: fonts.mono }}>{`${r.touchlessPct}%`}</span> },
    { width: '110px', align: 'right', header: 'Manual %', render: (r) => <span style={{ fontFamily: fonts.mono }}>{`${r.manualPct}%`}</span> },
    { width: '130px', align: 'right', header: 'Agent-resolved %', render: (r) => <span style={{ fontFamily: fonts.mono }}>{`${r.agentResolvedPct}%`}</span> },
    { width: '110px', align: 'right', header: 'Human %', render: (r) => <span style={{ fontFamily: fonts.mono }}>{`${r.humanPct}%`}</span> },
    // §15.4 — the commit is to touches per thousand, not to an automation percentage; it headlines the row.
    { width: '150px', align: 'right', header: 'Touches / 1,000', render: (r) => <span style={{ fontFamily: fonts.mono, color: colors.textPrimary }}>{`${r.touchesTodayPer1000} → ${r.touchesAfterPer1000}`}</span> },
  ]

  const causeColumns: Array<Column<CauseNode>> = [
    { width: '240px', header: 'Cause', render: (c) => <span style={{ color: colors.textPrimary }}>{c.name}</span> },
    { width: '160px', align: 'right', header: 'Share of exceptions %', render: (c) => <span style={{ fontFamily: fonts.mono }}>{`${c.sharePct}%`}</span> },
    { width: '180px', align: 'right', header: 'Agents can resolve %', render: (c) => <span style={{ fontFamily: fonts.mono }}>{`${c.agentResolvablePct}%`}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Agents</Eyebrow>
        <h1 style={titleStyle}>Touch economics</h1>
        {/* §15.1 — every agent surface carries the honesty label */}
        <SimTag />
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>The funnel and the two levers, per entity</p>
      </div>

      {/* The headline is the touch rate — touches per thousand invoices, not an automation percentage (§15.4) */}
      <section data-fct-summary style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Touch rate</Eyebrow>
          {/* §15.3 — the end state here is agents alone on today's volume; the lever progression below shows the other one */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'JGL · agents alone, on today’s exception volume'}</span>
        </div>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
          <Stat label="TOUCHES PER 1,000 INVOICES" value={`${jgl.touchesTodayPer1000} → ${jgl.touchesAfterPer1000}`} />
          <Stat label="MANUAL SHARE OF INVOICES" value={`${jgl.manualPct}% → ${jgl.humanPct}%`} />
        </div>
      </section>

      {/* §15.4 — the per-entity funnel; agent-resolved + human = manual for every row */}
      <section data-fct-funnel style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>The funnel — per entity</Eyebrow>
          {/* §15.3 — the end state shown here is agents alone on today's volume; the lever progression shows the other one */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'agents alone, on today’s exception volume'}</span>
        </div>
        <DataTable columns={funnelColumns} rows={funnel} rowKey={(r) => r.code} />
      </section>

      {/* §15.3 — the two levers shown separately: they compound, and they cost differently */}
      <section data-fct-levers style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>The two levers — JGL</Eyebrow>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, flexWrap: 'wrap' }}>
          {stages.map((s, i) => (
            <Fragment key={STAGE_SLUGS[i]}>
              {i > 0 && (
                <div data-fct-lever={LEVER_LABELS[i - 1]} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: 150 }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 16, color: colors.textMuted }}>→</span>
                  <span style={{ ...typeScale.body, color: colors.textSecondary, textAlign: 'center' }}>{LEVER_LABELS[i - 1]}</span>
                </div>
              )}
              <div data-fct-lever-stage={STAGE_SLUGS[i]} style={{ flex: 1, minWidth: 160, border: `1px solid ${colors.borderDefault}`, background: colors.bgRaised, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textFaint }}>{s.label.toUpperCase()}</span>
                {/* the touch rate leads each stage; the automation percentage follows it */}
                <span style={{ ...typeScale.kpiValue, color: colors.textPrimary }}>{String(s.touchesPer1000)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>touches / 1,000</span>
                <span style={{ ...typeScale.body, color: colors.textSecondary }}>{`${s.touchlessPct}% touchless`}</span>
                {/* §15.3 — the final stage is the other end state: causes eliminated first, then agents on the residue */}
                {STAGE_SLUGS[i] === 'effective-agents' && (
                  <span style={{ ...typeScale.body, color: colors.textSecondary }}>{'causes eliminated first, then agents on the residue'}</span>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      {/* §15.4 — JGL's cause mix: where the agent-resolved share comes from, per cause */}
      <section data-fct-causes style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>What agents can resolve — by cause</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>JGL</span>
        </div>
        <DataTable columns={causeColumns} rows={causes} rowKey={(c) => c.key} />
      </section>
    </div>
  )
}
