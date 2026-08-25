import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { listCauses, listExceptions } from '../api'
import { Eyebrow } from '../components'
import { formatCr } from '../lib/format'
import { ageColor, controlColor } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

type SortKey = 'value' | 'age' | 'vendor'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'value', label: 'Value' },
  { key: 'age', label: 'Age' },
  { key: 'vendor', label: 'Vendor' },
]

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 20 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const filterLabel: CSSProperties = typeScale.tableHeader
// spec/05 column grid; AMOUNT, AGE and CONTROL are right-aligned.
const gridCols = '130px 1fr 130px 90px 170px 130px 130px 110px'

export function Worklist() {
  const { code } = useParams()
  // Filter and sort live in the URL query string, not component state (spec/05).
  const [searchParams, setSearchParams] = useSearchParams()
  const causeKey = searchParams.get('cause') // absent ⇒ All
  const sortParam = searchParams.get('sort')
  const sort: SortKey = sortParam === 'age' || sortParam === 'vendor' ? sortParam : 'value'

  const causes = listCauses('p2p')
  const causeName = (key: string) => causes.find((c) => c.key === key)?.name ?? key

  function setParam(key: 'cause' | 'sort', value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
  }

  // The header aggregates recompute over the currently filtered rows.
  const rows = listExceptions(code ?? '', 'p2p')
    .filter((x) => !causeKey || x.reasonKey === causeKey)
    .sort((a, b) => {
      if (sort === 'value') return b.amount - a.amount
      if (sort === 'age') return b.ageDays - a.ageDays
      return a.vendor.localeCompare(b.vendor)
    })
  const totalValue = rows.reduce((sum, x) => sum + x.amount, 0)
  const agedValue = rows.filter((x) => x.ageDays > 30).reduce((sum, x) => sum + x.amount, 0)

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 4 — Exceptions</Eyebrow>
          <h1 style={titleStyle}>Blocked invoices worklist</h1>
        </div>
        <div style={{ display: 'flex', gap: 28, fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>
          <span>{`${rows.length} SHOWN`}</span>
          <span>{`VALUE ${formatCr(totalValue, 2)}`}</span>
          <span>{`>30 DAYS ${formatCr(agedValue, 2)}`}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={filterLabel}>Cause</span>
        <button type="button" className={`fct-chip${causeKey === null ? ' fct-chip--active' : ''}`} onClick={() => setParam('cause', null)}>
          All
        </button>
        {causes.map((c) => (
          <button key={c.key} type="button" className={`fct-chip${causeKey === c.key ? ' fct-chip--active' : ''}`} onClick={() => setParam('cause', c.key)}>
            {c.name}
          </button>
        ))}
        <span style={{ ...filterLabel, marginLeft: 'auto' }}>Sort</span>
        {SORTS.map((s) => (
          <button key={s.key} type="button" className={`fct-chip${sort === s.key ? ' fct-chip--active' : ''}`} onClick={() => setParam('sort', s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '12px 20px', borderBottom: `1px solid ${colors.borderDefault}`, ...typeScale.tableHeader }}>
          <span>Invoice</span>
          <span>Vendor</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ textAlign: 'right' }}>Age</span>
          <span>Blocking reason</span>
          <span>Plant</span>
          <span>Owner</span>
          <span style={{ textAlign: 'right' }}>Control</span>
        </div>
        {rows.length === 0 ? (
          // Empty state keeps the table shell in place — do not collapse it.
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '13px 20px' }}>
            <span style={{ gridColumn: '1 / -1', fontSize: 13, color: colors.textMuted }}>No exceptions match this cause</span>
          </div>
        ) : (
          rows.map((x) => (
            <Link
              key={x.id}
              to={`/entity/${code}/p2p/invoices/${x.id}`}
              className="fct-table-row"
              style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', padding: '13px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: 13, color: colors.textPrimary, textDecoration: 'none' }}
            >
              <span style={{ fontFamily: fonts.mono, color: colors.accentText }}>{x.id}</span>
              <span>{x.vendor}</span>
              <span style={{ fontFamily: fonts.mono, textAlign: 'right' }}>{formatCr(x.amount, 2)}</span>
              <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: ageColor(x.ageDays) }}>{`${x.ageDays} d`}</span>
              <span style={{ color: colors.textSecondary }}>{causeName(x.reasonKey)}</span>
              <span style={{ color: colors.textSecondary }}>{x.plant}</span>
              <span style={{ color: colors.textSecondary }}>{x.owner}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, textAlign: 'right', color: controlColor(x.controlImpact) }}>{x.controlImpact}</span>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
