import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { applyWorklistAction, causePool, getEntity, listCauses, listExceptions, plantRoute, vendorRoute } from '../api'
import type { Exception, WorklistAction } from '../api'
import { CrossProcessTrace, DataTable, Eyebrow, FreshnessStamp, type Column } from '../components'
import { formatCr } from '../lib/format'
import { ageColor, controlColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

type SortKey = 'value' | 'age' | 'vendor'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'value', label: 'Value' },
  { key: 'age', label: 'Age' },
  { key: 'vendor', label: 'Vendor' },
]

// §8.9 — the worklist is a working tool: every row supports Assign / Chase / Release, with bulk versions.
const ACTIONS: WorklistAction[] = ['assign', 'chase', 'release']

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const filterLabel: CSSProperties = typeScale.tableHeader
// spec/05 column grid; AMOUNT, AGE and CONTROL are right-aligned. Checkbox + Actions columns added in §8.9.
const actionChip: CSSProperties = { padding: '4px 8px', fontSize: 11 }

export function Worklist() {
  const { code } = useParams()
  // Filter and sort live in the URL query string, not component state (spec/05).
  const [searchParams, setSearchParams] = useSearchParams()
  const causeKey = searchParams.get('cause') // absent ⇒ All
  const sortParam = searchParams.get('sort')
  const sort: SortKey = sortParam === 'age' || sortParam === 'vendor' ? sortParam : 'value' // §8.9 — value desc is the default, never count
  const resolvableActive = searchParams.get('resolvable') === '1'

  const [selected, setSelected] = useState<string[]>([])
  const [, setVersion] = useState(0) // bump after store mutations to re-render rows

  const entity = getEntity(code ?? '')
  const resolvableCount = entity?.metrics.releasableItems

  const causes = listCauses('p2p')
  const causeName = (key: string) => causes.find((c) => c.key === key)?.name ?? key

  function setParam(key: 'cause' | 'sort' | 'resolvable', value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
    setSelected([]) // a filtered-out selection would miscount the bulk bar
  }

  function act(x: Exception, action: WorklistAction) {
    applyWorklistAction(x, action)
    setVersion((v) => v + 1)
  }

  function bulkAct(action: WorklistAction) {
    for (const x of rows) if (selected.includes(x.id)) applyWorklistAction(x, action)
    setSelected([])
    setVersion((v) => v + 1)
  }

  function releaseAllVisible() {
    for (const x of rows) applyWorklistAction(x, 'release')
    setSelected([])
    setVersion((v) => v + 1)
  }

  // The header aggregates recompute over the currently filtered rows.
  const rows = listExceptions(code ?? '', 'p2p')
    .filter((x) => !causeKey || x.reasonKey === causeKey)
    .filter((x) => !resolvableActive || x.resolvableToday) // §7.19 — "resolvable today": the clearing action is available and quick
    .sort((a, b) => {
      if (sort === 'value') return b.amount - a.amount
      if (sort === 'age') return b.ageDays - a.ageDays
      return a.vendor.localeCompare(b.vendor)
    })
  const totalValue = rows.reduce((sum, x) => sum + x.amount, 0)

  // §7.20 — denominators follow the filter: filtered to a cause, the pool is that cause's own pool; unfiltered it is entity-wide.
  const pool = causeKey ? causePool(code ?? '', causeKey) : undefined
  // §7.20 — the sample explains itself against the pool; a figure that cannot explain itself gets discounted.
  const resolvableVisible = rows.filter((x) => x.resolvableToday).length
  // §7.20 — value alone does not tell a controller whether the pool is stale: the >30-day share of what is shown.
  const staleValue = rows.filter((x) => x.ageDays > 30).reduce((a, x) => a + x.amount, 0)
  const headerSegments = [
    `${rows.length} of ${pool?.count ?? entity?.metrics.apBlockedCount ?? 0} shown`,
    `${formatCr(totalValue, 2)} of ${pool ? formatCr(pool.valueCr) : entity ? formatCr(entity.metrics.apBlocked.current) : '—'}`,
    `>30 days ${formatCr(staleValue, 2)}`,
  ]
  if (resolvableCount !== undefined) headerSegments.push(`${resolvableVisible} of ${resolvableCount} resolvable in this view`)

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  const unreleasedCount = rows.filter((r) => r.status !== 'released').length

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((r) => r.id))
  }

  function toggleOne(id: string) {
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const columns: Array<Column<Exception>> = [
    {
      width: '40px',
      header: <input type="checkbox" aria-label="Select all shown rows" checked={allSelected} onChange={toggleAll} />,
      render: (x) => <input type="checkbox" aria-label={`Select ${x.id}`} checked={selected.includes(x.id)} onChange={() => toggleOne(x.id)} />,
    },
    {
      width: '130px',
      header: 'Invoice',
      render: (x) => (
        <Link to={`/entity/${code}/p2p/invoices/${x.id}`} style={{ fontFamily: fonts.mono, color: colors.accentText, textDecoration: 'none' }}>
          {x.id}
        </Link>
      ),
    },
    // §7.24 — the vendor and plant cells drill to their counterparty pages; plain text where no page exists.
    {
      width: '1fr',
      header: 'Vendor',
      render: (x) => {
        const to = vendorRoute(code ?? '', x.vendor)
        return to ? <Link to={to} style={{ color: colors.accentText, textDecoration: 'none' }}>{x.vendor}</Link> : x.vendor
      },
    },
    { width: '130px', align: 'right', header: 'Amount', render: (x) => <span style={{ fontFamily: fonts.mono }}>{formatCr(x.amount, 2)}</span> },
    { width: '90px', align: 'right', header: 'Age', render: (x) => <span style={{ fontFamily: fonts.mono, color: ageColor(x.ageDays) }}>{`${x.ageDays} d`}</span> },
    { width: '180px', header: 'Blocking reason', render: (x) => <span style={{ color: colors.textSecondary }}>{causeName(x.reasonKey)}</span> },
    {
      detail: true,
      header: 'Plant',
      render: (x) => {
        const to = plantRoute(code ?? '', x.plant)
        return to ? <Link to={to} style={{ color: colors.accentText, textDecoration: 'none' }}>{x.plant}</Link> : <span style={{ color: colors.textSecondary }}>{x.plant}</span>
      },
    },
    { detail: true, header: 'Owner', render: (x) => <span style={{ color: colors.textSecondary }}>{x.owner}</span> },
    { detail: true, header: 'Control', render: (x) => <span style={{ fontFamily: fonts.mono, fontSize: 12, color: controlColor(x.controlSignificance) }}>{x.controlSignificance}</span> },
    {
      width: '236px',
      header: 'Actions',
      render: (x) =>
        x.status === 'released' ? (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.statusGreen }}>RELEASED</span>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {ACTIONS.map((a) => (
              <button key={a} type="button" className="fct-action-chip" onClick={() => act(x, a)} style={actionChip}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        ),
    },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 4 — Exceptions</Eyebrow>
          <h1 style={titleStyle}>Blocked invoices worklist</h1>
          {/* §8.7 — the worklist is read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.20 — one line: sample against pool, and why the visible resolvable count is what it is */}
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{headerSegments.join(' · ')}</span>
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
        {/* §7.19 — the resolvable-today set; every entity carries its anchored pool count (§7.19 table) */}
        <button type="button" className={`fct-chip${resolvableActive ? ' fct-chip--active' : ''}`} onClick={() => setParam('resolvable', resolvableActive ? null : '1')}>
          {resolvableCount !== undefined ? `${resolvableCount} resolvable today` : 'Resolvable today'}
        </button>
        <span style={{ ...filterLabel, marginLeft: 'auto' }}>Sort</span>
        {SORTS.map((s) => (
          <button key={s.key} type="button" className={`fct-chip${sort === s.key ? ' fct-chip--active' : ''}`} onClick={() => setParam('sort', s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {causeKey === 'missing-gr' && entity && (
        // §8.10 — filtered to the goods-receipt cause: this is the chain's second point
        <CrossProcessTrace code={entity.code} current="invoice" />
      )}

      <section style={{ ...clay.frame, fontSize: 13 }}>
        {selected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <span style={typeScale.tableHeader}>{`${selected.length} SELECTED`}</span>
            {ACTIONS.map((a) => (
              <button key={a} type="button" className="fct-action-chip" onClick={() => bulkAct(a)} style={actionChip}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        )}
        {resolvableActive && rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <span style={{ color: colors.textSecondary }}>{`${rows.length} low-effort items · ${formatCr(totalValue, 2)}`}</span>
            {unreleasedCount > 0 && (
              <button type="button" className="fct-action-chip" onClick={releaseAllVisible} style={actionChip}>
                {`Release all ${rows.length}`}
              </button>
            )}
          </div>
        )}
        <DataTable columns={columns} rows={rows} rowKey={(x) => x.id} />
        {rows.length === 0 && (
          // Empty state keeps the table shell in place — do not collapse it.
          <div style={{ padding: '13px 20px' }}>
            <span style={{ fontSize: 13, color: colors.textMuted }}>No exceptions match this cause</span>
          </div>
        )}
      </section>
    </div>
  )
}
