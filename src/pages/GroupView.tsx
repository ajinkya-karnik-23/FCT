import { useContext, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AGGREGATED_ROW_DEFINITION, computeScore, DIMENSION_DEFINITIONS, DIMENSION_KEYS, DIMENSION_LABELS, getEntity, getGroupSummary, getRecurringCauses, groupRows, GROUP_SCORE_DEFINITION, OPEN_EXCEPTIONS_DEFINITION, pointDirection, VALUE_AT_RISK_DEFINITION } from '../api'
import type { Grouping, Trend, TrendDelta } from '../api'
import { useAppMode, type CockpitMode } from '../app/mode'
import { DEFAULT_ENTITY } from '../app/routes'
import { AssistantContext } from '../features/assistant/AssistantDrawer'
import { Bar, CrossProcessTrace, DimensionBar, Eyebrow, FreshnessStamp, Metric } from '../components'
import { formatCr } from '../lib/format'
import { card, frame, kpiTile, pageStyle, sunken, tag } from '../theme/clay'
import { scoreColor, statusWord, trendColor } from '../theme/derive'
import { colors, fonts, fontWeights, radius, shadows, spacing, typeScale } from '../theme/tokens'

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

// Scan-table IA: one glance per row — name, score, a six-segment dimension strip, one chart
// (AP blocked), two glyph figures, breaches, and an expander. Everything else is one click away.
const gridCols = 'minmax(220px, 1.3fr) 96px 132px 150px 104px 78px 64px 32px'
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const rightMono: CSSProperties = { fontFamily: fonts.mono, fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

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
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.12em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: color ?? colors.textPrimary }}>{value}</span>
      {delta !== undefined && (
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: trendColor(direction ?? 'flat') }}>{`${delta > 0 ? '+' : ''}${delta}`}</span>
      )}
    </div>
  )
}

// Number + direction glyph; the % delta and sparkline live in the expansion.
function Glyph({ value, trend, inverse }: { value: string; trend: Trend; inverse: boolean }) {
  const d = pointDirection(trend.current, trend.previous, inverse)
  const glyph = trend.current === trend.previous ? '–' : trend.current > trend.previous ? '▲' : '▼'
  return (
    <span style={{ ...rightMono, color: colors.textSecondary, display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6 }}>
      {value}
      <span aria-hidden style={{ fontSize: 9, color: trendColor(d) }}>{glyph}</span>
    </span>
  )
}

export function GroupView() {
  const [grouping, setGrouping] = useState<Grouping>('entity')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const { mode } = useAppMode() // §8.5 — the close-progress card's eyebrow is mode-aware
  const assistant = useContext(AssistantContext)
  const summary = getGroupSummary()
  const causes = getRecurringCauses()
  const close = summary.closeProgress
  const transform = summary.transformationHealth

  // Worst first, capped rows pinned — the controller scans for trouble, not for alphabet.
  const rows = groupRows(grouping)
    .map((r) => {
      const entity = grouping === 'entity' ? getEntity(r.key) : undefined
      const result = entity ? computeScore(entity) : null
      return { r, entity, result, capped: result?.cappedBy ?? null }
    })
    .sort((a, b) => Number(Boolean(b.capped)) - Number(Boolean(a.capped)) || a.r.score - b.r.score)

  const transformRows: { label: string; value: string; color?: string }[] = [
    { label: 'Automation rate', value: `${transform.automationRatePct}% ↑`, color: colors.statusGreen },
    { label: 'Repeat exceptions', value: `${transform.repeatExceptionsQoqPct}% QoQ`, color: colors.statusGreen },
    { label: 'Causes eliminated', value: `${transform.causeElimination.eliminated} of ${transform.causeElimination.identified}` }, // §7.5 — group backlog figures; notStarted derived, never stored
    { label: 'Touchless invoices', value: `${transform.touchlessInvoicesPct}%` },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 0 — Group</Eyebrow>
          <h1 style={titleStyle}>{HEADINGS[grouping]}</h1>
          {/* §8.7 — mixed sources: SAP ECC for the health figures, close tracker for the progress card */}
          <FreshnessStamp sources={['SAP ECC', 'close tracker']} />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* §7.15/§7.16 — score and exception counts now have pinned priors; two-point deltas, no series */}
          {/* §8.6.1 — each derived KPI states what it counts on hover; the text lives with the accessor */}
          <div title={GROUP_SCORE_DEFINITION} style={kpiTile}>
            <Kpi label="GROUP SCORE" value={String(summary.score)} color={scoreColor(summary.score)} delta={summary.score - summary.scorePrevious} direction={pointDirection(summary.score, summary.scorePrevious, false)} />
          </div>
          <div title={VALUE_AT_RISK_DEFINITION} style={kpiTile}>
            <Metric label="VALUE AT RISK" value={formatCr(summary.valueAtRiskCr)} trend={summary.valueAtRiskTrend} inverse={true} valueStyle={{ ...typeScale.kpiValue }} />
          </div>
          <div title={OPEN_EXCEPTIONS_DEFINITION} style={kpiTile}>
            <Kpi label="OPEN EXCEPTIONS" value={summary.openExceptions.toLocaleString('en-IN')} delta={summary.openExceptions - summary.openExceptionsPrevious} direction={pointDirection(summary.openExceptions, summary.openExceptionsPrevious, true)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: radius.pill, boxShadow: shadows.in }}>
          {GROUPINGS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                setGrouping(g.key)
                setOpenKey(null)
              }}
              aria-pressed={grouping === g.key}
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '8px 16px',
                border: 'none',
                borderRadius: radius.pill,
                background: grouping === g.key ? colors.accent : 'transparent',
                color: grouping === g.key ? '#FFFFFF' : colors.textMuted,
                boxShadow: grouping === g.key ? shadows.upSm : 'none',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 10.5, color: colors.textFaint }}>Sorted worst first · capped rows pinned</span>
      </div>

      <section style={frame}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16, padding: '10px 18px 10px', borderBottom: `1px solid ${colors.borderSubtle}`, ...typeScale.tableHeader }}>
          <span>{COLUMN_LABELS[grouping]}</span>
          <span>Score</span>
          <span>Dimensions</span>
          <span>AP blocked</span>
          <span style={{ textAlign: 'right' }}>AR &gt;90D</span>
          <span style={{ textAlign: 'right' }}>Close</span>
          <span style={{ textAlign: 'right' }}>Breaches</span>
          <span />
        </div>

        {rows.map(({ r, result, capped, entity }, idx) => {
          const open = openKey === r.key
          const activeVetoes = entity ? entity.vetoes.filter((v) => v.active) : []
          const rowStyle: CSSProperties = {
            display: 'grid',
            gridTemplateColumns: gridCols,
            gap: 16,
            alignItems: 'center',
            minHeight: 58,
            padding: '10px 18px',
            color: colors.textPrimary,
            textDecoration: 'none',
            background: open ? colors.bgRaised : undefined,
          }
          const stop = (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
          }
          const cells = (
            <>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: fontWeights.semibold }}>{r.label}</span>
                {capped && (
                  <>
                    {/* §3.5 — the badge names the binding veto; click reveals raw score and every active cap */}
                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e)
                        setRevealedKey(revealedKey === r.key ? null : r.key)
                      }}
                      style={{ ...tag(colors.statusRed, colors.bgRiskSoft), border: 'none', cursor: 'pointer', textAlign: 'left', whiteSpace: 'normal', width: 'fit-content' }}
                    >
                      {`CAPPED — ${capped.reason}`}
                    </button>
                    {revealedKey === r.key && (
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
                        <span>{`raw ${result!.raw}`}</span>
                        {activeVetoes.map((v) => (
                          <span key={v.id}>{`${v.reason} — cap ${v.cap}${v.id === capped.id ? ' · binding' : ''}`}</span>
                        ))}
                      </span>
                    )}
                    {/* The veto explains itself where it appears — asks about this row's entity, not the page default */}
                    <button
                      type="button"
                      className="fct-ask-btn"
                      onClick={(e) => {
                        stop(e)
                        assistant?.ask('Why is this entity capped?', r.key)
                      }}
                      style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', padding: '5px 10px', width: 'fit-content' }}
                    >
                      Ask why it is capped
                    </button>
                  </>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: fonts.mono, fontSize: 18, fontWeight: fontWeights.bold, color: scoreColor(r.score), fontVariantNumeric: 'tabular-nums' }}>{r.score}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.1em', color: colors.textFaint }}>{statusWord(r.score)}</span>
              </span>
              {/* Six-segment strip: status-keyed by threshold; each segment states what it counts on hover and
                  carries label, score and §7.15 delta as screen-reader text — colour is never the only carrier. */}
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, height: 12, padding: 2, borderRadius: radius.sm, boxShadow: shadows.in }}>
                {DIMENSION_KEYS.map((key) => {
                  const d = r.dimensions[key] - r.dimensionsPrevious[key]
                  return (
                    <span key={key} title={DIMENSION_DEFINITIONS[key]} style={{ borderRadius: 3, background: scoreColor(r.dimensions[key]) }}>
                      <span className="fct-sr-only">{`${DIMENSION_LABELS[key]} ${r.dimensions[key]} `}</span>
                      <span className="fct-sr-only">{`${d > 0 ? '+' : ''}${d}`}</span>
                    </span>
                  )
                })}
              </span>
              {/* §8.3 — the one chart per row: the headline money figure with its delta and sparkline */}
              <Metric compact value={formatCr(r.apBlockedCr.current)} trend={r.apBlockedCr} inverse={true} />
              <Glyph value={formatCr(r.arOver90Cr.current)} trend={r.arOver90Cr} inverse={true} />
              <Glyph value={`${r.closePercent.current}%`} trend={r.closePercent} inverse={false} />
              <span style={{ ...rightMono, fontWeight: fontWeights.bold, color: r.controlBreaches > 3 ? colors.statusRed : r.controlBreaches > 0 ? colors.statusAmber : colors.statusGreen }}>{r.controlBreaches}</span>
              <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="fct-expand"
                  aria-expanded={open}
                  aria-label={open ? `Hide ${r.label} details` : `Show ${r.label} details`}
                  onClick={(e) => {
                    stop(e)
                    setOpenKey(open ? null : r.key)
                  }}
                >
                  {open ? '–' : '+'}
                </button>
              </span>
            </>
          )
          const detail = open && (
            <div style={{ ...sunken, margin: '0 10px 12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                {DIMENSION_KEYS.map((key) => (
                  <DimensionBar key={key} dimension={key} value={r.dimensions[key]} previous={r.dimensionsPrevious[key]} />
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, paddingTop: 12, borderTop: `1px solid ${colors.borderSubtle}` }}>
                <Metric label="AP blocked" value={formatCr(r.apBlockedCr.current)} trend={r.apBlockedCr} inverse={true} />
                <Metric label="AR >90D" value={formatCr(r.arOver90Cr.current)} trend={r.arOver90Cr} inverse={true} />
                <Metric label="Cash unapplied" value={formatCr(r.cashUnappliedCr.current)} trend={r.cashUnappliedCr} inverse={true} />
                <Metric label="Close" value={`${r.closePercent.current}%`} trend={r.closePercent} inverse={false} />
              </div>
            </div>
          )
          const divider = idx < rows.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined
          return grouping === 'entity' ? (
            <div key={r.key} style={{ borderBottom: divider }}>
              <Link to={`/entity/${r.key}`} className="fct-table-row" style={rowStyle}>
                {cells}
              </Link>
              {detail}
            </div>
          ) : (
            // §8.6.1 — an aggregated row states how it is built on hover; the text lives with groupRows()
            <div key={r.key} style={{ borderBottom: divider }}>
              <div className="fct-table-row" title={AGGREGATED_ROW_DEFINITION} style={rowStyle}>
                {cells}
              </div>
              {detail}
            </div>
          )
        })}
      </section>

      {/* §8.5 — the close-progress card is a close-window figure; in BAU it does not render, so the row drops to two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: mode === 'bau' ? '1fr 1fr' : '1fr 1fr 1fr', gap: spacing.gapCards }}>
        <section style={{ ...card, gap: 14 }}>
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
          <section id="fct-close-card" style={{ ...card, gap: 14 }}>
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
            <Bar value={close.pct} max={100} height={10} color={colors.statusGreen} />
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

        <section style={{ ...card, gap: 12 }}>
          <Eyebrow style={typeScale.tableHeader}>Transformation health</Eyebrow>
          {transformRows.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{r.label}</span>
              <span style={{ fontFamily: fonts.mono, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
