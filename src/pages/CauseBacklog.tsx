import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { causeBacklogCounts, causeEliminationTrend, currentPeriodEliminations, listCauseBacklog, OPEN_EXCEPTIONS_DEFINITION } from '../api'
import type { CauseBacklogEntry, ProcessKey } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, Metric } from '../components'
import type { Column } from '../components'
import { formatCr, formatRecurrence } from '../lib/format'
import { causeEliminationColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }
const dimStyle: CSSProperties = { color: colors.textFaint }

// §7.30 — the register is group-scoped; process labels are display-only (the dataset keeps machine keys).
const PROCESS_LABEL: Record<ProcessKey, string> = { p2p: 'P2P', o2c: 'O2C', r2r: 'R2R' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The six trend periods are the last six months; index 5 is the current month (§7.21 relative clock).
function periodLabel(i: number): string {
  const now = new Date()
  return MONTHS[new Date(now.getFullYear(), now.getMonth() - (5 - i), 1).getMonth()]
}

function formatTarget(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

export function CauseBacklog() {
  const rows = listCauseBacklog()
  const counts = causeBacklogCounts()
  const trend = causeEliminationTrend()
  const p6 = currentPeriodEliminations()

  // Both tiles read the same six points as the grid below, so the asserted relationship is checkable point by point.
  const elimTrend = { current: trend.eliminatedSeries[5], previous: trend.eliminatedSeries[4], series: trend.eliminatedSeries }
  const openTrend = { current: trend.openExceptionsSeries[5], previous: trend.openExceptionsSeries[4], series: trend.openExceptionsSeries }

  const columns: Array<Column<CauseBacklogEntry>> = [
    {
      header: 'Cause',
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Back to the root-cause screen for this cause at this entity */}
          <Link to={`/entity/${row.entityCode}/root-cause/${row.processKey}/${row.causeKey}`} style={{ color: colors.accentText, textDecoration: 'none' }}>{row.name}</Link>
          {row.processKey === 'p2p' && (
            // Forward to the exceptions this cause generates — P2P only; the dataset carries no O2C exception list.
            <Link to={`/entity/${row.entityCode}/p2p/invoices?cause=${row.causeKey}`} style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint, textDecoration: 'none' }}>exceptions →</Link>
          )}
        </span>
      ),
    },
    { header: 'Process', width: '84px', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{PROCESS_LABEL[row.processKey]}</span> },
    { header: 'Entity', width: '70px', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{row.entityCode}</span> },
    { header: 'Value at risk', width: '120px', align: 'right', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{formatCr(row.valueAtRisk)}</span> },
    { header: 'Recurrence', detail: true, render: (row) => <span style={{ color: colors.textSecondary }}>{formatRecurrence(row.recurrence)}</span> },
    { header: 'Owner', detail: true, render: (row) => row.owner },
    { header: 'Target date', width: '120px', render: (row) => (row.targetDate ? <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{formatTarget(row.targetDate)}</span> : <span title="Not started — no commitment yet" style={dimStyle}>—</span>) },
    { header: 'Status', width: '130px', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.08em', color: causeEliminationColor(row.status) }}>{row.status.toUpperCase()}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Cause elimination</h1>
        {/* §8.7 — the register is read from SAP ECC */}
        <FreshnessStamp sources={['SAP ECC']} />
      </div>

      {/* §7.30 headline counts, derived from the register (never stored) */}
      <div style={{ display: 'flex', gap: 40 }}>
        <Stat label="IDENTIFIED" value={String(counts.identified)} />
        <Stat label="ELIMINATED" value={String(counts.eliminated)} />
        <Stat label="IN PROGRESS" value={String(counts.inProgress)} />
        <Stat label="NOT STARTED" value={String(counts.notStarted)} />
      </div>

      {/* The register — one row per identified cause, at entity level */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Register</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${rows.length} causes`}</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </section>

      {/* §7.30 — the mechanism: as cumulative eliminations rise, group open exceptions fall across the same six points */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>The mechanism</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>six periods · cumulative eliminations against group open exceptions</span>
        </div>
        <div style={{ display: 'flex', gap: 40 }}>
          <Metric label="CAUSES ELIMINATED" value={String(elimTrend.current)} trend={elimTrend} inverse={false} />
          {/* §8.6.1 — the same group open-exception figure as the Group view header; one definition wherever it appears */}
          <div title={OPEN_EXCEPTIONS_DEFINITION}>
            <Metric label="GROUP OPEN EXCEPTIONS" value={openTrend.current.toLocaleString('en-IN')} trend={openTrend} inverse={true} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 16, paddingBottom: 8 }}>
            <span style={{ width: 90, flexShrink: 0 }} />
            <span style={{ ...monoLabelStyle, flex: 1 }}>CAUSES ELIMINATED · CUMULATIVE</span>
            <span style={{ ...monoLabelStyle, flex: 1 }}>GROUP OPEN EXCEPTIONS</span>
          </div>
          {trend.eliminatedSeries.map((elim, i) => (
            <div key={i} className="fct-mech-row" style={{ display: 'flex', gap: 16, padding: '7px 0', borderTop: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ width: 90, flexShrink: 0, fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>{periodLabel(i)}</span>
              <span data-series="eliminated" style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary }}>{elim}</span>
              <span data-series="open-exceptions" style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{trend.openExceptionsSeries[i].toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        {/* §7.30 overclaim guard — say which of the two the screen is showing */}
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`Eliminating a cause reduces the rate at which new exceptions arrive; it does not clear the existing pool. The six points above are group open-exception counts across periods — the falling pool as eliminations accumulate.`}</p>
        <p style={{ ...typeScale.body, color: colors.textPrimary, margin: 0 }}>{`The ${p6.count} causes eliminated this period generated ${p6.generatedLastPeriod} exceptions last period and none in this one.`}</p>
      </section>
    </div>
  )
}
