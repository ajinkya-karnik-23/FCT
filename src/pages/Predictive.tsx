import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { driverOpenAtMonthEnd, getCounterparty, getEntity, getForecast, projectDsoDays } from '../api'
import type { DriverAssumption, ForecastDriver, RankedAction } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, Metric } from '../components'
import type { Column } from '../components'
import { formatCr } from '../lib/format'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }

// §7.3 — the headline reads whole days in the base case ('72', not '72.0'); contested cases keep one decimal.
function fmtDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const tagStyle = (c: string): CSSProperties => clay.tag(c)
const controlButtonStyle: CSSProperties = clay.controlPill(false)

export function Predictive() {
  // §7.23 — every entity carries its own DSO forecast; the route is per-entity so JRP shows JRP's numbers.
  const { code } = useParams()
  const [assumptions, setAssumptions] = useState<Record<string, DriverAssumption>>({})
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Predictive</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }
  const forecast = getForecast(entity.code)!
  const projected = projectDsoDays(forecast, assumptions)

  // Keyed by driver id: labels repeat across entities and the component is reused when only :code changes.
  const setAssumption = (id: string, patch: DriverAssumption) => {
    setAssumptions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // §7.3 — the state tag is display-only; whether a driver counts at month-end is decided once, in driverOpenAtMonthEnd.
  const stateTag = (d: ForecastDriver) => {
    const a = assumptions[d.id] ?? {}
    if (!driverOpenAtMonthEnd(d, a)) return <span style={tagStyle(colors.statusGreen)}>{a.resolved ? 'RESOLVED' : 'SETTLES BY MONTH-END'}</span>
    return <span style={tagStyle(colors.statusAmber)}>OPEN AT MONTH-END</span>
  }

  const driverColumns: Array<Column<ForecastDriver>> = [
    {
      // §7.24 — a customer driver drills to its counterparty page; cash drivers have no page and stay plain text.
      header: 'Driver',
      width: '250px',
      render: (d) => {
        const cp = getCounterparty(d.id)
        return cp ? <Link to={`/entity/${code}/customer/${cp.id}`} style={{ color: colors.accentText, textDecoration: 'none' }}>{d.label}</Link> : d.label
      },
    },
    { header: 'Value', width: '110px', align: 'right', render: (d) => <span style={{ fontFamily: fonts.mono }}>{formatCr(d.valueCr)}</span> },
    { header: 'Days impact', width: '130px', align: 'right', render: (d) => <span style={{ fontFamily: fonts.mono }}>{`+${d.impact.toFixed(1)}`}</span> },
    {
      header: 'Assumed settlement',
      width: '200px',
      render: (d) => {
        const a = assumptions[d.id] ?? {}
        return (
          <input
            type="date"
            value={a.settleIso ?? d.baseSettleIso ?? ''}
            disabled={!!a.resolved}
            onChange={(e) => setAssumption(d.id, { settleIso: e.target.value })}
            style={{ ...clay.sunken, fontFamily: fonts.mono, fontSize: 12, color: a.resolved ? colors.textFaint : colors.textPrimary, background: colors.bgPanel, border: 'none', padding: '5px 10px', outline: 'none' }}
          />
        )
      },
    },
    {
      header: 'State',
      render: (d) => {
        const a = assumptions[d.id] ?? {}
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stateTag(d)}
            {/* §7.3 — the controller contests each driver; the projection recalculates live. data-driver-id gives
                tests and drill scripts a stable handle that does not depend on row order. */}
            <button type="button" data-driver-id={d.id} onClick={() => setAssumption(d.id, a.resolved ? { resolved: false } : { resolved: true })} style={controlButtonStyle}>{a.resolved ? 'UNDO' : 'MARK RESOLVED'}</button>
          </div>
        )
      },
    },
  ]

  const actionColumns: Array<Column<RankedAction>> = [
    { header: '#', width: '52px', render: (a) => <span style={{ fontFamily: fonts.mono, color: colors.textMuted }}>{a.rank}</span> },
    { header: 'Action', render: (a) => a.action },
    { header: 'Owner', width: '170px', render: (a) => <span style={{ color: colors.textSecondary }}>{a.owner}</span> },
    { header: 'Effort', width: '90px', render: (a) => <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{a.effort}</span> },
    { header: 'Days recovered', align: 'right', render: (a) => <span style={{ fontFamily: fonts.mono }}>{a.improvement.toFixed(1)}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Predictive</Eyebrow>
          {/* §7.3 — the headline is live: it moves as assumptions are contested below */}
          <h1 style={titleStyle}>{`DSO ${forecast.current} today → ${fmtDays(projected)} projected at month-end`}</h1>
          {/* §8.7 — mixed sources: SAP ECC for the base figures, entity metrics cited inline below */}
          <FreshnessStamp sources={['SAP ECC', 'entity metrics']} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={tagStyle(colors.textMuted)}>{entity.code}</span>
          {/* §7.3 — return to the base case; a contested forecast is only useful if it can be reset */}
          <button type="button" onClick={() => setAssumptions({})} style={controlButtonStyle}>RESET TO BASE CASE</button>
        </div>
      </div>

      {/* §8.6 — the DPO honesty flag: headline figure with the blocked-invoice adjustment beside it */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>DPO today</Eyebrow>
          {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: entity metrics</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* §8.5.1 — DPO is direction-neutral: rising terms and unprocessable invoices both raise it */}
          <Metric label="DPO" value={`${entity.metrics.dpo.current} days`} trend={entity.metrics.dpo} inverse={null} />
          {/* §8.6 — same sentence as Working capital, tied to the same entity metrics so the figures cannot drift */}
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`Includes ${formatCr(entity.metrics.apBlocked.current)} of blocked invoices; adjusted DPO ${entity.metrics.dpoAdjusted} days.`}</span>
        </div>
      </section>

      {/* §7.3 — the drivers behind the move; each assumption is contestable and the projection recalculates live */}
      <section style={cardStyle}>
        <Eyebrow style={typeScale.tableHeader}>DSO drivers</Eyebrow>
        <DataTable columns={driverColumns} rows={forecast.drivers} rowKey={(r) => r.id} />
      </section>

      {/* §7.3 — ranked by movement per unit of effort, not by size of improvement; the data is stored in that order */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Ranked actions</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'ranked by days recovered per unit of effort, not by size of improvement'}</span>
        </div>
        <DataTable columns={actionColumns} rows={forecast.actions} rowKey={(r) => r.rank} />
      </section>
    </div>
  )
}
