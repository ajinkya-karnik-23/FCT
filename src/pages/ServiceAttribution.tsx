import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { computeScore, getEntity, getServiceMetrics, HEALTH_SCORE_DEFINITION, requestTypeForSla, serviceDeskStats, serviceDeskWindow, serviceScorecard, SERVICE_SCORECARD_DEFINITION, slaBreachSplit } from '../api'
import type { Attribution, ServiceMetric, SlaBreachSplit } from '../api'
import { DataTable, Eyebrow, FreshnessStamp } from '../components'
import type { Column } from '../components'
import { scoreColor, statusWord } from '../theme/derive'
import { barHeights, colors, fonts, spacing, typeScale, shadows } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
// §4 — gross/net labels; same mono tag style as the read-only / CAPPED tags on this screen.
const scoreLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }

// §5 — stacked bar: attribution order and the four segment colours (accent → ageingBarAlt → borderAccent → textFaintest).
const ATTRIBUTION_ORDER: Attribution[] = ['client', 'provider', 'system', 'thirdParty']
const ATTRIBUTION_LABELS: Record<Attribution, string> = { client: 'client', provider: 'provider', system: 'system', thirdParty: 'third party' }
const SEGMENT_COLORS: Record<Attribution, string> = { client: colors.accent, provider: colors.ageingBarAlt, system: colors.borderAccent, thirdParty: colors.textFaintest }

type Segment = { key: Attribution; label: string; count: number; color: string }

// Render-only merge (§5): a segment under 5% of the raw share folds into its predecessor so no
// unreadable sliver renders. The stored data keeps all four counts — collapsing it would break the
// tie between the group total and the per-entity rows.
function buildSegments(split: SlaBreachSplit): Segment[] {
  const segments: Segment[] = []
  for (const key of ATTRIBUTION_ORDER) {
    const count = split.counts[key]
    if (!count) continue
    const share = split.total ? count / split.total : 0
    if (share < 0.05 && segments.length > 0) {
      const prev = segments[segments.length - 1]
      prev.count += count
      prev.label = `${prev.label} & ${ATTRIBUTION_LABELS[key]}`
    } else {
      segments.push({ key, label: ATTRIBUTION_LABELS[key], count, color: SEGMENT_COLORS[key] })
    }
  }
  return segments
}

// §7.7/§7.29 — why an SLA is not yet measurable; the tooltip wording is the honesty feature. The three desk SLAs have
// left this map: they are 'measuring' now and render live to-date figures instead of a greyed dash.
const UNMEASURABLE_REASON: Record<'needs-register', string> = {
  'needs-register': 'Not measurable yet — requires manual register input.',
}

function attributionText(split: Record<Attribution, number>): string {
  return ATTRIBUTION_ORDER.filter((k) => split[k] > 0).map((k) => `${ATTRIBUTION_LABELS[k]} ${split[k]}`).join(' · ')
}

export function ServiceAttribution() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Service & attribution</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  // §5/§7.22 — the bar shows this entity's own split; the group split sits beneath it as comparison,
  // because "which entities are worse than the group" is the first question a controller asks.
  const split = slaBreachSplit(entity.code)
  const groupSplit = slaBreachSplit()
  const segments = buildSegments(split)
  const scorecard = serviceScorecard(entity.code)
  // §4 — the exclusion-set note only earns its place when the two readings actually differ; a zero delta is not a caveat.
  const exclusionDelta = Math.abs(scorecard.net - scorecard.altNet)
  const score = computeScore(entity)
  const statusColor = scoreColor(score.displayed)

  // §7.29 — the desk went live mid-period; both values derive from today (§7.21) in a single site (serviceDeskWindow).
  const deskWindow = serviceDeskWindow()
  // §7.7/§7.29 — needs-register rows render greyed with no fabricated number; measuring rows show a pending dash that
  // names what it is waiting for instead of an achievement %.
  const dimStyle: CSSProperties | undefined = { color: colors.textFaint }
  const unmeasuredCell = (row: ServiceMetric) => {
    // Only needs-register rows reach this cell; the guard keeps the index type-safe.
    const reason = row.measurability === 'needs-register' ? UNMEASURABLE_REASON[row.measurability] : ''
    return <span className="fct-sla-unmeasured" title={reason} style={{ fontFamily: fonts.mono, ...dimStyle }}>—</span>
  }
  const pendingCell = (title: string) => (
    <span className="fct-sla-pending" title={title} style={{ fontFamily: fonts.mono, ...dimStyle }}>—</span>
  )

  const slaColumns: Array<Column<ServiceMetric>> = [
    {
      header: 'SLA',
      width: '340px',
      render: (row) => {
        if (row.measurability === 'day-one') return <span>{row.sla}</span>
        if (row.measurability === 'measuring') {
          // §7.29 — live current-period-to-date figures, derived at read time from the request rows; never stored on ServiceMetric.
          const type = requestTypeForSla(row.sla)
          const stats = type ? serviceDeskStats(entity.code, type) : undefined
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'normal' }}>
              <span>{row.sla}</span>
              <span style={dimStyle}>{`measuring since ${deskWindow.measuringSince} · first full-period report from ${deskWindow.nextPeriod}`}</span>
              {stats && (
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${stats.open} open · oldest ${stats.oldestEffectiveDays} d · avg resolution ${stats.avgResolutionDays} d · ${stats.stoppedHours} h stopped`}</span>
              )}
            </div>
          )
        }
        return <span title={UNMEASURABLE_REASON[row.measurability]} style={dimStyle}>{row.sla}</span>
      },
    },
    { header: 'Target', width: '150px', render: (row) => <span style={row.measurability === 'needs-register' ? dimStyle : undefined}>{row.target}</span> },
    {
      header: 'Achieved',
      width: '110px',
      align: 'right',
      render: (row) => {
        if (row.measurability === 'day-one') return <span style={{ fontFamily: fonts.mono }}>{`${row.achieved!.toFixed(1)}%`}</span>
        if (row.measurability === 'measuring') return pendingCell(`No achievement % until a full period has elapsed — first report from ${deskWindow.nextPeriod}`)
        return unmeasuredCell(row)
      },
    },
    {
      header: 'Breaches',
      width: '110px',
      align: 'right',
      render: (row) => {
        if (row.measurability === 'day-one') return <span style={{ fontFamily: fonts.mono }}>{row.breaches}</span>
        if (row.measurability === 'measuring') return pendingCell(`Not yet reported — measuring since ${deskWindow.measuringSince}`)
        return unmeasuredCell(row)
      },
    },
    {
      header: 'Attribution split',
      render: (row) => {
        if (row.measurability === 'needs-register') return unmeasuredCell(row)
        if (row.measurability === 'measuring') return pendingCell(`Not yet reported — measuring since ${deskWindow.measuringSince}`)
        const text = attributionText(row.attributionSplit!)
        // A day-one row with zero breaches has nothing to attribute — a dash, not an empty cell.
        return text ? <span style={{ fontSize: 12, color: colors.textSecondary }}>{text}</span> : <span style={dimStyle}>—</span>
      },
    },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Service & attribution</Eyebrow>
        <h1 style={titleStyle}>Where the delays come from</h1>
        {/* §8.7 — no SAP figures on this screen; both feeds are cited inline below */}
        <FreshnessStamp sources={['SLA breach log', 'service metrics']} />
      </div>

      {/* §5/§7.22 — SLA breaches by origin for this entity, with the group split beneath as comparison */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>SLA breaches by origin</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${entity.code} · ${split.total} breaches`}</span>
            {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: SLA breach log</span>
          </div>
        </div>
        <div className="fct-sla-bar" style={{ display: 'flex', height: barHeights.ageing, background: colors.bgSelected, borderRadius: 6, boxShadow: shadows.in, overflow: 'hidden' }}>
          {segments.map((seg) => (
            <div key={seg.key} className="fct-sla-seg" title={`${seg.label}: ${seg.count} of ${split.total}`} style={{ width: `${(seg.count / split.total) * 100}%`, background: seg.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
          {segments.map((seg) => (
            <span key={seg.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color }} />
              {seg.label}
              <span style={{ fontFamily: fonts.mono, color: colors.textMuted }}>{`${seg.count} · ${Math.round((seg.count / split.total) * 100)}%`}</span>
            </span>
          ))}
        </div>
        {/* §7.22 — entity vs group, same order as the legend; percentages from slaBreachSplit */}
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${entity.code} ${split.pct.client} / ${split.pct.provider} / ${split.pct.system} / ${split.pct.thirdParty} · group ${groupSplit.pct.client} / ${groupSplit.pct.provider} / ${groupSplit.pct.system} / ${groupSplit.pct.thirdParty}`}</span>
      </section>

      {/* §4 — two separate objects, side by side, never merged into one number */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.gapCards }}>
        {/* Health score drills to the entity home where the full score panel lives (§8.4) */}
        <Link to={`/entity/${entity.code}`} className="fct-link" style={{ ...cardStyle, textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
            <Eyebrow style={typeScale.tableHeader}>Health score</Eyebrow>
            <span style={{ ...clay.tag(statusColor), fontSize: 11, letterSpacing: '0.12em' }}>{statusWord(score.displayed)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ ...typeScale.bigScore, color: statusColor }}>{score.displayed}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textFaint }}>/100</span>
          </div>
          {score.cappedBy && (
            <span style={{ alignSelf: 'flex-start', ...clay.tag(colors.statusRed, colors.bgRiskSoft) }}>{`CAPPED — ${score.cappedBy.reason}`}</span>
          )}
          <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{HEALTH_SCORE_DEFINITION}</p>
        </Link>

        {/* Service scorecard — the only object that carries service credits (§4) */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
            <Eyebrow style={typeScale.tableHeader}>Service scorecard</Eyebrow>
            {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: service metrics</span>
          </div>
          {/* §4/§7.22 — gross and net side by side; never net alone, that reads as excuse-making */}
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <span style={scoreLabelStyle}>{'Gross achievement'}</span>
              <div><span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{`${scorecard.gross.toFixed(1)}%`}</span></div>
            </div>
            <div>
              <span style={scoreLabelStyle}>{'Net of client, system and third-party delay'}</span>
              <div><span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{`${scorecard.net.toFixed(1)}%`}</span></div>
            </div>
          </div>
          <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{SERVICE_SCORECARD_DEFINITION}</p>
          {/* §4 — name the exclusion set exactly and size how much the two readings differ for this entity; suppressed when they agree */}
          {exclusionDelta.toFixed(1) !== '0.0' && (
            <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{`The exclusion set is a contract term — whether an interface failure stops the clock depends on who operates the interface; for ${entity.code} the two readings differ by ${exclusionDelta.toFixed(1)} points.`}</p>
          )}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>Service credits attach here</span>
        </section>
      </div>

      {/* §7.7/§7.29 — SLA table; measuring rows carry live to-date figures, needs-register rows stay greyed with no fabricated values */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Service level agreements</Eyebrow>
          {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: service metrics</span>
        </div>
        <DataTable columns={slaColumns} rows={getServiceMetrics(entity.code)} rowKey={(r) => r.sla} />
      </section>
    </div>
  )
}
