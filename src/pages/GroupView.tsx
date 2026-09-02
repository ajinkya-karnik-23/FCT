import { useContext, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AGGREGATED_ROW_DEFINITION, computeScore, DIMENSION_KEYS, getEntity, getGroupSummary, getRecurringCauses, groupRows, GROUP_SCORE_DEFINITION, OPEN_EXCEPTIONS_DEFINITION, pointDirection, VALUE_AT_RISK_DEFINITION } from '../api'
import type { Grouping, TrendDelta } from '../api'
import { useAppMode, type CockpitMode } from '../app/mode'
import { DEFAULT_ENTITY } from '../app/routes'
import { AssistantContext } from '../features/assistant/AssistantDrawer'
import { Bar, CrossProcessTrace, DimensionBar, Eyebrow, FreshnessStamp, Metric, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { breachColor, scoreColor, statusWord, trendColor } from '../theme/derive'
import { colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'

// Prototype scaling: the fill is sharePct * 3.4 % of the track width.
const CAUSE_FILL_SCALE = 3.4

// §2 — grouping toggle above the group table; headings and column labels per grouping.
const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: 'entity', label: 'Entity' },
  { key: 'segment', label: 'Segment' },
  { key: 'geography', label: 'Geography' },
]

const HEADINGS: Record<Grouping, string> = {
  entity: 'Finance health across six legal entities',
  segment: 'Finance health across five segments',
  geography: 'Finance health across three geographies',
}

const COLUMN_LABELS: Record<Grouping, string> = {
  entity: 'Legal entity',
  segment: 'Segment',
  geography: 'Geography',
}

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 24 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }
// §8.3 — metric columns carry value + delta side by side, so they are wider than the old number-only cells.
const gridCols = '240px 150px 1fr 110px 110px 110px 95px 65px'
const moneyCell: CSSProperties = { fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' }

// §8.2/§8.5 — the close-progress card's eyebrow per mode; in BAU the close cycle has not
// started, so the card (a close-window figure) does not render at all and only these two keys exist.
const CLOSE_CARD_EYEBROW: Record<Exclude<CockpitMode, 'bau'>, string> = {
  close: 'Close progress — day 4',
  preclose: 'Pre-close readiness — 3 days to close',
}

// §7.15/§7.16 — header KPIs with a pinned prior period carry a two-point delta line (no series).
function Kpi({ label, value, color, delta, direction }: { label: string; value: string; color?: string; delta?: number; direction?: TrendDelta['direction'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: color ?? colors.textPrimary }}>{value}</span>
      {delta !== undefined && (
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: trendColor(direction ?? 'flat') }}>{`${delta > 0 ? '+' : ''}${delta}`}</span>
      )}
    </div>
  )
}

export function GroupView() {
  const [grouping, setGrouping] = useState<Grouping>('entity')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const { mode } = useAppMode() // §8.5 — the close-progress card's eyebrow is mode-aware
  const assistant = useContext(AssistantContext)
  const rows = groupRows(grouping)
  const summary = getGroupSummary()
  const causes = getRecurringCauses()
  const close = summary.closeProgress
  const transform = summary.transformationHealth

  const transformRows: { label: string; value: string; color?: string }[] = [
    { label: 'Automation rate', value: `${transform.automationRatePct}% ↑`, color: colors.statusGreen },
    { label: 'Repeat exceptions', value: `${transform.repeatExceptionsQoqPct}% QoQ`, color: colors.statusGreen },
    { label: 'Causes eliminated', value: `${transform.causeElimination.eliminated} of ${transform.causeElimination.identified}` }, // §7.5 — group backlog figures; notStarted derived, never stored
    { label: 'Touchless invoices', value: `${transform.touchlessInvoicesPct}%` },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 0 — Group</Eyebrow>
          <h1 style={titleStyle}>{HEADINGS[grouping]}</h1>
          {/* §8.7 — mixed sources: SAP ECC for the health figures, close tracker for the progress card */}
          <FreshnessStamp sources={['SAP ECC', 'close tracker']} />
        </div>
        <div style={{ display: 'flex', gap: 34 }}>
          {/* §7.15/§7.16 — score and exception counts now have pinned priors; two-point deltas, no series */}
          {/* §8.6.1 — each derived KPI states what it counts on hover; the text lives with the accessor */}
          <div title={GROUP_SCORE_DEFINITION}>
            <Kpi label="GROUP SCORE" value={String(summary.score)} color={scoreColor(summary.score)} delta={summary.score - summary.scorePrevious} direction={pointDirection(summary.score, summary.scorePrevious, false)} />
          </div>
          <div title={VALUE_AT_RISK_DEFINITION}>
            <Metric label="VALUE AT RISK" value={formatCr(summary.valueAtRiskCr)} trend={summary.valueAtRiskTrend} inverse={true} valueStyle={{ ...typeScale.kpiValue }} />
          </div>
          <div title={OPEN_EXCEPTIONS_DEFINITION}>
            <Kpi label="OPEN EXCEPTIONS" value={summary.openExceptions.toLocaleString('en-IN')} delta={summary.openExceptions - summary.openExceptionsPrevious} direction={pointDirection(summary.openExceptions, summary.openExceptionsPrevious, true)} />
          </div>
        </div>
      </div>

      <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px 0' }}>
          {GROUPINGS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGrouping(g.key)}
              aria-pressed={grouping === g.key}
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                border: `1px solid ${grouping === g.key ? colors.borderAccent : colors.borderDefault}`,
                background: grouping === g.key ? colors.bgSelected : 'transparent',
                color: grouping === g.key ? colors.textPrimary : colors.textMuted,
                cursor: 'pointer',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.borderDefault}`,
            ...typeScale.tableHeader,
          }}
        >
          <span>{COLUMN_LABELS[grouping]}</span>
          <span>Health</span>
          <span>Dimensions</span>
          <span style={{ textAlign: 'right' }}>AP blocked</span>
          <span style={{ textAlign: 'right' }}>AR &gt;90D</span>
          <span style={{ textAlign: 'right' }}>Unapplied</span>
          <span style={{ textAlign: 'right' }}>Close</span>
          <span style={{ textAlign: 'right' }}>Breaches</span>
        </div>
        {rows.map((r) => {
          // Vetoes are per-entity; aggregated rows (segment/geography) never carry one.
          const entity = grouping === 'entity' ? getEntity(r.key) : undefined
          const result = entity ? computeScore(entity) : null
          const capped = result?.cappedBy ?? null
          const activeVetoes = entity ? entity.vetoes.filter((v) => v.active) : []
          const rowStyle: CSSProperties = {
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.borderSubtle}`,
            alignItems: 'center',
            color: colors.textPrimary,
          }
          const cells = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StatusDot size={8} color={scoreColor(r.score)} />
                <span style={{ fontSize: 14, fontWeight: fontWeights.medium }}>{r.label}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: fontWeights.semibold, color: scoreColor(r.score) }}>{r.score}</span>
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{statusWord(r.score)}</span>
                </span>
                {capped && (
                  <>
                    {/* §3.5 — the badge names the binding veto; click reveals raw score and every active cap */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setRevealedKey(revealedKey === r.key ? null : r.key)
                      }}
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        padding: '3px 6px',
                        border: `1px solid ${colors.statusRed}`,
                        background: 'transparent',
                        color: colors.statusRed,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {`CAPPED — ${capped.reason}`}
                    </button>
                    {/* The veto explains itself where it appears — asks about this row's entity, not the page default */}
                    <button
                      type="button"
                      className="fct-ask-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        assistant?.ask('Why is this entity capped?', r.key)
                      }}
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        padding: '3px 6px',
                        border: `1px solid ${colors.accent}`,
                        background: 'transparent',
                        color: colors.textPrimary,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      Ask why it is capped
                    </button>
                    {revealedKey === r.key && (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
                        <span>{`raw ${result!.raw}`}</span>
                        {activeVetoes.map((v) => (
                          <span key={v.id}>{`${v.reason} — cap ${v.cap}${v.id === capped.id ? ' · binding' : ''}`}</span>
                        ))}
                      </span>
                    )}
                  </>
                )}
              </span>
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {DIMENSION_KEYS.map((key) => (
                  <DimensionBar key={key} dimension={key} value={r.dimensions[key]} previous={r.dimensionsPrevious[key]} />
                ))}
              </span>
              {/* §8.3 — headline money/close cells show delta + sparkline; breaches has no prior period */}
              <Metric compact value={formatCr(r.apBlockedCr.current)} trend={r.apBlockedCr} inverse={true} />
              <Metric compact value={formatCr(r.arOver90Cr.current)} trend={r.arOver90Cr} inverse={true} />
              <Metric compact value={formatCr(r.cashUnappliedCr.current)} trend={r.cashUnappliedCr} inverse={true} valueStyle={{ color: colors.textSecondary }} />
              <Metric compact value={`${r.closePercent.current}%`} trend={r.closePercent} inverse={false} valueStyle={{ color: colors.textSecondary }} />
              <span style={{ ...moneyCell, color: breachColor(r.controlBreaches) }}>{r.controlBreaches}</span>
            </>
          )
          return grouping === 'entity' ? (
            <Link key={r.key} to={`/entity/${r.key}`} className="fct-table-row" style={{ ...rowStyle, textDecoration: 'none' }}>
              {cells}
            </Link>
          ) : (
            // §8.6.1 — an aggregated row states how it is built on hover; the text lives with groupRows()
            <div key={r.key} className="fct-table-row" title={AGGREGATED_ROW_DEFINITION} style={rowStyle}>
              {cells}
            </div>
          )
        })}
      </section>

      {/* §8.5 — the close-progress card is a close-window figure; in BAU it does not render, so the row drops to two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: mode === 'bau' ? '1fr 1fr' : '1fr 1fr 1fr', gap: spacing.gapCards }}>
        <section style={{ ...cardStyle, gap: 14 }}>
          <Eyebrow style={typeScale.tableHeader}>Group-wide recurring causes</Eyebrow>
          {causes.map((c) => (
            <div key={`${c.processKey}-${c.name}`} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{`${c.name} (${c.processKey.toUpperCase()})`}</span>
              <span style={{ width: 110, flexShrink: 0 }}>
                <Bar value={c.sharePct * CAUSE_FILL_SCALE} max={100} />
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 42, textAlign: 'right' }}>{`${c.sharePct}%`}</span>
            </div>
          ))}
        </section>

        {mode !== 'bau' && (
          <section id="fct-close-card" style={{ ...cardStyle, gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              {/* §8.2 — the eyebrow is mode-aware; the countdown belongs only where it is true */}
              <Eyebrow style={typeScale.tableHeader}>{CLOSE_CARD_EYEBROW[mode]}</Eyebrow>
              {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
              <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{'read-only · source: close tracker'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={typeScale.kpiValue}>{`${close.pct}%`}</span>
              <span style={{ ...typeScale.body, color: colors.textMuted }}>{`of ${close.totalTasks} tasks complete`}</span>
            </div>
            <Bar value={close.pct} max={100} height={8} />
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: colors.textSecondary }}>
              <span>{`${close.overdue} overdue`}</span>
              <span style={{ color: colors.statusRed }}>{`${close.blockers} blockers`}</span>
              <span>{`${close.entitiesAtRisk} entities at risk`}</span>
            </div>

            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 12 }}>
              {/* §8.10 — the group-level end of the cross-tower chain; its links follow the default entity's path */}
              <CrossProcessTrace code={DEFAULT_ENTITY} current="close" />
            </div>
          </section>
        )}

        <section style={{ ...cardStyle, gap: 12 }}>
          <Eyebrow style={typeScale.tableHeader}>Transformation health</Eyebrow>
          {transformRows.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{r.label}</span>
              <span style={{ fontFamily: fonts.mono, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
