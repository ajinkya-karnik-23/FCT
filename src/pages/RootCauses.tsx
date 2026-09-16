import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { rootCauseItemsTo } from '../app/paths'
import { causeEliminationTrend, currentPeriodEliminations, getCause, getAgent, listCauses, listEntities, listRootCauses, openExceptions, OPEN_EXCEPTIONS_DEFINITION, rootCauseCounts } from '../api'
import type { ProcessKey, RootCauseEntry } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, Metric } from '../components'
import type { Column } from '../components'
import { formatCr } from '../lib/format'
import { causeEliminationColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }
const dimStyle: CSSProperties = { color: colors.textFaint }

// §7.21 — the six trend periods are the last six months; index 5 is the current month (relative clock).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <span style={monoLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = { ...clay.sunken, background: colors.bgPanel, border: 'none', padding: '10px 14px', fontSize: 13, color: colors.textPrimary, outline: 'none' }

// §17 — the root cause register (group level): one row per root cause under a §6.1 cause, grouped by cause and
// filterable by process / cause / entity. The ?cause= parameter is the drill target from the P2P worklist (§17.10).
export function RootCauses() {
  const [params] = useSearchParams()

  // §17.10 — a deep link (?cause=<key>) lands on that cause's section; an unknown key falls back to the full register.
  const allCauses = [...listCauses('p2p'), ...listCauses('o2c')]
  const linkedCause = params.get('cause') ?? ''
  const validLinked = allCauses.some((c) => c.key === linkedCause) ? linkedCause : 'all'

  // The deep-link key was validated against the union above, so its process comes from that same node — not a blind lookup.
  const [processFilter, setProcessFilter] = useState<'all' | 'P2P' | 'O2C'>(
    validLinked !== 'all' ? (allCauses.find((c) => c.key === validLinked)?.processKey === 'p2p' ? 'P2P' : 'O2C') : 'all',
  )
  const [causeFilter, setCauseFilter] = useState<string>(validLinked)
  const [entityFilter, setEntityFilter] = useState<string>('all')

  // §17.10 — this component survives navigation between /root-causes and its ?cause= deep links, so the filters must follow the URL:
  // leaving a section (rail → /root-causes) clears it; jumping cause-to-cause re-filters.
  useEffect(() => {
    if (validLinked === 'all') {
      setProcessFilter('all')
      setCauseFilter('all')
    } else {
      setProcessFilter(allCauses.find((c) => c.key === validLinked)?.processKey === 'p2p' ? 'P2P' : 'O2C')
      setCauseFilter(validLinked)
    }
  }, [validLinked])

  const causeOptions = processFilter === 'all' ? allCauses : listCauses(processFilter.toLowerCase() as 'p2p' | 'o2c')

  // Grouped by cause in taxonomy order; within a cause, largest value at risk first.
  const causeOrder = new Map(allCauses.map((c, i) => [c.key, i]))
  const rows = listRootCauses()
    .filter(
      (e) =>
        (processFilter === 'all' || e.process === processFilter) &&
        (causeFilter === 'all' || e.parentCause === causeFilter) &&
        (entityFilter === 'all' || e.entityCodes.includes(entityFilter)),
    )
    .sort((a, b) => (causeOrder.get(a.parentCause)! - causeOrder.get(b.parentCause)!) || b.valueCr - a.valueCr)

  const counts = rootCauseCounts()
  const trend = causeEliminationTrend()
  const p6 = currentPeriodEliminations()

  // Both tiles read the same six points as the grid below, so the asserted relationship is checkable point by point.
  const closedTrend = { current: trend.closedSeries[5], previous: trend.closedSeries[4], series: trend.closedSeries }
  const openTrend = { current: trend.openExceptionsSeries[5], previous: trend.openExceptionsSeries[4], series: trend.openExceptionsSeries }

  const columns: Array<Column<RootCauseEntry>> = [
    {
      header: 'Cause',
      width: '190px',
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>{getCause(row.parentCause, row.process.toLowerCase() as ProcessKey)?.name ?? row.parentCause}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{row.process}</span>
        </span>
      ),
    },
    { header: 'Root cause', render: (row) => row.why },
    { header: 'Value at risk', width: '120px', align: 'right', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{formatCr(row.valueCr)}</span> },
    // §17.4 — the figure is what is open behind the entry now, and a drill to those items: eliminated entries have nothing
    // open (0, no drill), fixed-at-source shows where its residue has drained to; identified/in-progress carry their count.
    { header: 'Affected items', width: '120px', align: 'right', render: (row) => {
      const figure = row.state === 'eliminated' ? 0 : row.state === 'fixed-at-source' && row.residueTrend ? row.residueTrend[row.residueTrend.length - 1] : row.affectedItems
      const to = row.state === 'eliminated' ? null : rootCauseItemsTo(row.id)
      return to ? <Link to={to} style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>{figure}</Link> : <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{figure}</span>
    } },
    { header: 'State', width: '130px', render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.08em', color: causeEliminationColor(row.state) }}>{row.state.toUpperCase()}</span> },
    {
      header: 'Fix & timeline',
      detail: true,
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{row.fix}</span>
          {row.state === 'in-progress' && row.targetDate && (
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{`target ${formatTarget(row.targetDate)}`}</span>
          )}
          {row.state === 'eliminated' && (
            // §17.4 — the third leg of the triangulation: arrivals stop exactly when the inflow stops.
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{`${row.newArrivals} new this period`}</span>
          )}
          {row.state === 'fixed-at-source' && row.residueTrend && (
            // §17.3 — inflow stopped, stock draining: the residue must fall across the six periods.
            <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{`residue ${row.residueTrend.join(' → ')} · open items, six periods`}</span>
          )}
        </span>
      ),
    },
    {
      header: 'Owner & agent',
      detail: true,
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{row.owner}</span>
          {/* §17.8 — a register where every entry has an agent would be less credible; the structural changes are not something an agent does */}
          {row.agentId ? (
            // The agent cell is a drill to that agent's record, where its action log shows what it did on this cause's items.
            <Link to={`/agents/${row.agentId}`} style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.accentText, textDecoration: 'none' }}>{`agent · ${getAgent(row.agentId)?.name ?? row.agentId}`}</Link>
          ) : (
            <span style={dimStyle}>no agent can act</span>
          )}
        </span>
      ),
    },
    { header: 'Entities', detail: true, render: (row) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{row.entityCodes.join(' · ')}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Root causes</h1>
        {/* §8.7 — the register is read from SAP ECC */}
        <FreshnessStamp sources={['SAP ECC']} />
      </div>

      {/* §17 headline counts, derived from the register (never stored) */}
      <div style={{ display: 'flex', gap: 40 }}>
        <Stat label="IDENTIFIED" value={String(counts.identified)} />
        <Stat label="ELIMINATED" value={String(counts.eliminated)} />
        <Stat label="FIXED AT SOURCE" value={String(counts['fixed-at-source'])} />
        <Stat label="IN PROGRESS" value={String(counts['in-progress'])} />
      </div>

      {/* The register — one row per root cause, grouped by cause */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Register</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${rows.length} root causes`}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Field label="PROCESS">
            <select className="fct-input" value={processFilter} onChange={(e) => { const v = e.target.value as 'all' | 'P2P' | 'O2C'; setProcessFilter(v); if (v !== 'all' && causeFilter !== 'all' && allCauses.find((c) => c.key === causeFilter)?.processKey !== v.toLowerCase()) setCauseFilter('all') }} style={inputStyle}>
              <option value="all">All</option>
              <option value="P2P">P2P</option>
              <option value="O2C">O2C</option>
            </select>
          </Field>
          <Field label="CAUSE">
            <select className="fct-input" value={causeFilter} onChange={(e) => setCauseFilter(e.target.value)} style={inputStyle}>
              <option value="all">All causes</option>
              {causeOptions.map((c) => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="ENTITY">
            <select className="fct-input" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={inputStyle}>
              <option value="all">All entities</option>
              {listEntities().map((en) => (
                <option key={en.code} value={en.code}>{en.code}</option>
              ))}
            </select>
          </Field>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </section>

      {/* §7.30 — the mechanism: as root causes close, group open exceptions fall across the same six points */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>The mechanism</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>six periods · cumulative closures against group open exceptions</span>
        </div>
        <div style={{ display: 'flex', gap: 40 }}>
          {/* The closed count is eliminated + fixed-at-source entries — say so, since the register shows the two states separately. */}
          <Metric label="ELIMINATED + FIXED AT SOURCE" value={String(closedTrend.current)} trend={closedTrend} inverse={false} />
          {/* §8.6.1 — the same group open-exception figure as the Group view header; one definition wherever it appears */}
          <div title={OPEN_EXCEPTIONS_DEFINITION}>
            <Metric label="GROUP OPEN EXCEPTIONS" value={openExceptions().toLocaleString('en-IN')} trend={openTrend} inverse={true} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 16, paddingBottom: 8 }}>
            <span style={{ width: 90, flexShrink: 0 }} />
            <span style={{ ...monoLabelStyle, flex: 1 }}>ELIMINATED + FIXED AT SOURCE · CUMULATIVE</span>
            <span style={{ ...monoLabelStyle, flex: 1 }}>GROUP OPEN EXCEPTIONS</span>
          </div>
          {trend.closedSeries.map((closed, i) => (
            <div key={i} className="fct-mech-row" style={{ display: 'flex', gap: 16, padding: '7px 0', borderTop: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ width: 90, flexShrink: 0, fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>{periodLabel(i)}</span>
              <span data-series="closed" style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary }}>{closed}</span>
              <span data-series="open-exceptions" style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{trend.openExceptionsSeries[i].toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
        {/* §7.30 overclaim guard — say which of the two the screen is showing */}
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`Closing a root cause stops the inflow; it does not clear the existing pool. The six points above are group open-exception counts across periods — the falling pool as closures accumulate.`}</p>
        <p style={{ ...typeScale.body, color: colors.textPrimary, margin: 0 }}>{`The ${p6.count} root causes closed this period generated ${p6.generatedLastPeriod} exceptions last period and none in this one.`}</p>
      </section>
    </div>
  )
}
