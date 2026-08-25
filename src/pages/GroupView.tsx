import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getGroupSummary, getRecurringCauses, listEntities } from '../api'
import { Bar, Eyebrow, StatusDot } from '../components'
import { formatCr } from '../lib/format'
import { breachColor, scoreColor, statusWord } from '../theme/derive'
import { barHeights, colors, fonts, fontWeights, spacing, typeScale } from '../theme/tokens'

const DIM_LABELS = ['Close', 'Control', 'Wk capital', 'Process', 'Service'] as const
// Prototype scaling: the fill is sharePct * 3.4 % of the track width.
const CAUSE_FILL_SCALE = 3.4

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 24 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }
const gridCols = '300px 120px 1fr 130px 130px 130px 110px 90px'
const moneyCell: CSSProperties = { fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' }

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: color ?? colors.textPrimary }}>{value}</span>
    </div>
  )
}

export function GroupView() {
  const entities = listEntities()
  const summary = getGroupSummary()
  const causes = getRecurringCauses()
  const close = summary.closeProgress
  const transform = summary.transformationHealth

  const transformRows: { label: string; value: string; color?: string }[] = [
    { label: 'Automation rate', value: `${transform.automationRatePct}% ↑`, color: colors.statusGreen },
    { label: 'Repeat exceptions', value: `${transform.repeatExceptionsQoqPct}% QoQ`, color: colors.statusGreen },
    { label: 'Causes eliminated', value: transform.causesEliminated },
    { label: 'Touchless invoices', value: `${transform.touchlessInvoicesPct}%` },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 0 — Group</Eyebrow>
          <h1 style={titleStyle}>Finance health across six legal entities</h1>
        </div>
        <div style={{ display: 'flex', gap: 34 }}>
          <Kpi label="GROUP SCORE" value={String(summary.score)} color={scoreColor(summary.score)} />
          <Kpi label="VALUE AT RISK" value={formatCr(summary.valueAtRiskCr)} />
          <Kpi label="OPEN EXCEPTIONS" value={summary.openExceptions.toLocaleString('en-IN')} />
        </div>
      </div>

      <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.borderDefault}`,
            ...typeScale.tableHeader,
          }}
        >
          <span>Legal entity</span>
          <span>Health</span>
          <span>Dimensions</span>
          <span style={{ textAlign: 'right' }}>AP blocked</span>
          <span style={{ textAlign: 'right' }}>AR &gt;90D</span>
          <span style={{ textAlign: 'right' }}>Unapplied</span>
          <span style={{ textAlign: 'right' }}>Close</span>
          <span style={{ textAlign: 'right' }}>Breaches</span>
        </div>
        {entities.map((e) => (
          <Link
            key={e.code}
            to={`/entity/${e.code}`}
            className="fct-table-row"
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              padding: '16px 20px',
              borderBottom: `1px solid ${colors.borderSubtle}`,
              alignItems: 'center',
              color: colors.textPrimary,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusDot size={8} color={scoreColor(e.score)} />
              <span style={{ fontSize: 14, fontWeight: fontWeights.medium }}>{e.name}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: fontWeights.semibold, color: scoreColor(e.score) }}>{e.score}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{statusWord(e.score)}</span>
            </span>
            <span style={{ display: 'flex', gap: 6, paddingRight: 24 }}>
              {e.dims.map((d, i) => (
                <span
                  key={DIM_LABELS[i]}
                  title={DIM_LABELS[i]}
                  style={{ flex: 1, height: barHeights.dimensionColumn, background: colors.borderSubtle, display: 'flex', alignItems: 'flex-end' }}
                >
                  <span style={{ width: '100%', height: Math.round((barHeights.dimensionColumn * d) / 100), background: scoreColor(d) }} />
                </span>
              ))}
            </span>
            <span style={moneyCell}>{formatCr(e.apBlocked)}</span>
            <span style={moneyCell}>{formatCr(e.arOver90)}</span>
            <span style={{ ...moneyCell, color: colors.textSecondary }}>{formatCr(e.cashUnapplied)}</span>
            <span style={{ ...moneyCell, color: colors.textSecondary }}>{e.closePct}%</span>
            <span style={{ ...moneyCell, color: breachColor(e.controlBreaches) }}>{e.controlBreaches}</span>
          </Link>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.gapCards }}>
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

        <section style={{ ...cardStyle, gap: 14 }}>
          <Eyebrow style={typeScale.tableHeader}>Close progress — day 4</Eyebrow>
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
        </section>

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
