import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { applyWorklistAction, causePool, causesPool, customerRoute, getEntity, getRootCause, laneForException, listCauses, listExceptions } from '../api'
import type { Exception, WorklistAction } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, type Column } from '../components'
import { formatCr } from '../lib/format'
import { ageColor, controlColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

type SortKey = 'value' | 'age' | 'customer'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'value', label: 'Value' },
  { key: 'age', label: 'Age' },
  { key: 'customer', label: 'Customer' },
]

// §18.3 — same grammar as the blocked-invoice worklist: value-ranked, cause-filterable, multi-select, agent lane,
// evidence trail, actions. No cycle button and no resolvable-today set: agents are modelled for P2P causes only in
// this build (§15.8), and every O2C row clears through a customer conversation, not a same-day release.
const ACTIONS: WorklistAction[] = ['assign', 'chase', 'release']

type LaneKey = 'needs-you' | 'working' | 'escalated' | 'never-automated' | 'all'

const LANES: Array<{ key: LaneKey; label: string }> = [
  { key: 'needs-you', label: 'Needs you' },
  { key: 'working', label: 'Working' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'never-automated', label: 'Never automated' },
  { key: 'all', label: 'All' },
]

function laneMatches(lane: LaneKey, state: ReturnType<typeof laneForException>['state']): boolean {
  if (lane === 'all') return true
  if (lane === 'needs-you') return state !== 'resolved'
  return lane === state
}

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const filterLabel: CSSProperties = typeScale.tableHeader
// Same column grid as the P2P worklist; AMOUNT and AGE are right-aligned.
const actionChip: CSSProperties = { padding: '4px 8px', fontSize: 11 }

export function O2CWorklist() {
  const { code } = useParams()
  // Filter and sort live in the URL query string, not component state (spec/05).
  const [searchParams, setSearchParams] = useSearchParams()
  // §17.4 — the cause filter is multi-select (comma-joined in the URL); a stage drill can carry several causes at once (§18.4).
  const selectedCauses: string[] = searchParams.get('cause')?.split(',').filter(Boolean) ?? []
  // §17.4 — ?rc=<register id> drills to the items traced to one root cause (from the register's Items figure, §17.10).
  const rcParam = searchParams.get('rc')
  const rcEntry = rcParam ? getRootCause(rcParam) : undefined
  const sortParam = searchParams.get('sort')
  const sort: SortKey = sortParam === 'age' || sortParam === 'customer' ? sortParam : 'value' // value desc is the default, never count
  // §15.7 — navigation defaults to "needs you"; a drill from a financial figure (cause filter or register row) shows
  // everything behind that figure. An explicit lane param always wins over both defaults.
  const laneParam = searchParams.get('lane')
  const defaultLane: LaneKey = selectedCauses.length > 0 || rcEntry ? 'all' : 'needs-you'
  const lane: LaneKey = laneParam === 'working' || laneParam === 'escalated' || laneParam === 'never-automated' || laneParam === 'all' || laneParam === 'needs-you' ? laneParam : defaultLane

  const [selected, setSelected] = useState<string[]>([])
  const [, setVersion] = useState(0) // bump after store mutations to re-render rows

  const entity = getEntity(code ?? '')

  const causes = listCauses('o2c')
  const causeName = (key: string) => causes.find((c) => c.key === key)?.name ?? key

  function setParam(key: 'sort' | 'lane', value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setSearchParams(next)
    setSelected([]) // a filtered-out selection would miscount the bulk bar
  }

  // §17.4 — cause chips are multi-select; entering a register drill clears them (two different scopes, one wins).
  function setCause(keys: string[]) {
    const next = new URLSearchParams(searchParams)
    if (keys.length === 0) next.delete('cause')
    else next.set('cause', keys.join(','))
    next.delete('rc')
    setSearchParams(next)
    setSelected([])
  }

  function toggleCause(key: string) {
    setCause(selectedCauses.includes(key) ? selectedCauses.filter((k) => k !== key) : [...selectedCauses, key])
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

  // The header aggregates recompute over the currently filtered rows.
  const rows = listExceptions(code ?? '', 'o2c')
    .filter((x) => (rcEntry ? x.rootCauseId === rcEntry.id : selectedCauses.length === 0 || selectedCauses.includes(x.reasonKey)))
    .filter((x) => laneMatches(lane, laneForException(x).state)) // §15.7 — the agent lane; every O2C row is never-automated in this build
    .sort((a, b) => {
      if (sort === 'value') return b.amount - a.amount
      if (sort === 'age') return b.ageDays - a.ageDays
      return a.vendor.localeCompare(b.vendor)
    })
  const totalValue = rows.reduce((sum, x) => sum + x.amount, 0)

  // §7.20 — denominators follow the filter: a cause selection pools those causes' own pools; a register drill pools that
  // entry's items and value at risk (§17.4); unfiltered it is entity-wide — all six O2C causes pooled together, which
  // sums exactly to o2cExceptionCount by largest-remainder. An unknown cause key falls back to the same full pool on
  // both sides, like its P2P pair falls back to apBlocked.
  const fullPool = causesPool(code ?? '', causes.map((c) => c.key), 'o2c')
  const pool = rcEntry
    ? { count: rcEntry.affectedItems, valueCr: rcEntry.valueCr }
    : selectedCauses.length === 0
      ? fullPool
      : selectedCauses.length === 1
        ? causePool(code ?? '', selectedCauses[0], 'o2c')
        : causesPool(code ?? '', selectedCauses, 'o2c')
  // §7.20 — value alone does not tell a controller whether the pool is stale: the >30-day share of what is shown.
  const staleValue = rows.filter((x) => x.ageDays > 30).reduce((a, x) => a + x.amount, 0)
  // §7.20 — sample against pool; no resolvable segment (nothing in O2C clears same-day) and no agent-disposition
  // segment (no agents run on this process in this build — the per-row lane says so).
  const headerSegments = [
    `${rows.length} of ${pool?.count ?? entity?.metrics.o2cExceptionCount ?? 0} shown`,
    `${formatCr(totalValue, 2)} of ${pool ? formatCr(pool.valueCr) : fullPool ? formatCr(fullPool.valueCr) : '—'}`,
    `>30 days ${formatCr(staleValue, 2)}`,
  ]

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id))

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
      header: 'Item',
      render: (x) => (
        <Link to={`/entity/${code}/o2c/invoices/${x.id}`} style={{ fontFamily: fonts.mono, color: colors.accentText, textDecoration: 'none' }}>
          {x.id}
        </Link>
      ),
    },
    // §7.24 — the customer cell drills to its counterparty page; plain text where no page exists (a name outside the
    // forecast drivers has none). Plant stays plain: plant pages hold blocked-AP work only.
    {
      width: '1fr',
      header: 'Customer',
      render: (x) => {
        const to = customerRoute(code ?? '', x.vendor)
        return to ? <Link to={to} style={{ color: colors.accentText, textDecoration: 'none' }}>{x.vendor}</Link> : x.vendor
      },
    },
    { width: '130px', align: 'right', header: 'Amount', render: (x) => <span style={{ fontFamily: fonts.mono }}>{formatCr(x.amount, 2)}</span> },
    { width: '90px', align: 'right', header: 'Age', render: (x) => <span style={{ fontFamily: fonts.mono, color: ageColor(x.ageDays) }}>{`${x.ageDays} d`}</span> },
    // §17.9 — one line on the item row where a root cause has been traced; the path itself lives in the expansion.
    {
      width: '180px',
      header: 'Blocking reason',
      render: (x) => {
        const rc = x.rootCauseId ? getRootCause(x.rootCauseId) : undefined
        return (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: colors.textSecondary }}>{causeName(x.reasonKey)}</span>
            {rc && <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{`root cause · ${rc.why}`}</span>}
          </span>
        )
      },
    },
    { detail: true, header: 'Plant', render: (x) => <span style={{ color: colors.textSecondary }}>{x.plant}</span> },
    { detail: true, header: 'Owner', render: (x) => <span style={{ color: colors.textSecondary }}>{x.owner}</span> },
    { detail: true, header: 'Control', render: (x) => <span style={{ fontFamily: fonts.mono, fontSize: 12, color: controlColor(x.controlSignificance) }}>{x.controlSignificance}</span> },
    // §17.9 — the path walked to reach the root cause; expandable on the few traced examples only, not seeded everywhere.
    {
      detail: true,
      header: 'Root cause',
      render: (x) => {
        if (!x.rootCauseId || !x.traversal) return <span style={{ color: colors.textFaint }}>not yet traced</span>
        const rc = getRootCause(x.rootCauseId)
        return (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rc && <span>{rc.why}</span>}
            {x.traversal.map((step, i) => (
              <span key={i} style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{`${i + 1}. ${step}`}</span>
            ))}
          </span>
        )
      },
    },
    // §15.7 — the per-row agent lane; every O2C row reads why it never ran rather than pretending an agent is on it.
    {
      width: '200px',
      header: 'Agent',
      render: (x) => {
        const l = laneForException(x)
        if (l.state === 'working') return <span style={{ color: colors.accentText }}>{`working · ${l.detail}`}</span>
        if (l.state === 'escalated') return <span style={{ color: colors.statusRed }}>{`escalated to you — ${l.detail}`}</span>
        if (l.state === 'resolved') {
          return (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ color: colors.statusGreen }}>agent resolved</span>
              <Link to={`/entity/${code}/o2c/invoices/${x.id}`} style={{ color: colors.accentText, textDecoration: 'none' }}>why →</Link>
            </span>
          )
        }
        return <span style={{ color: colors.textMuted }}>{l.detail}</span>
      },
    },
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
          <h1 style={titleStyle}>O2C exceptions worklist</h1>
          {/* §8.7 — the worklist is read from SAP ECC */}
          <FreshnessStamp sources={['SAP ECC']} />
        </div>
        {/* §7.20 — one line: sample against pool, and why the visible count is what it is */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{headerSegments.join(' · ')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!rcEntry && (
          <>
            <span style={filterLabel}>Cause</span>
            <button type="button" className={`fct-chip${selectedCauses.length === 0 ? ' fct-chip--active' : ''}`} onClick={() => setCause([])}>
              All
            </button>
            {causes.map((c) => (
              <button key={c.key} type="button" className={`fct-chip${selectedCauses.includes(c.key) ? ' fct-chip--active' : ''}`} onClick={() => toggleCause(c.key)}>
                {c.name}
              </button>
            ))}
          </>
        )}
        {/* §15.7 — filter by the row's agent lane; every choice is an explicit URL value so it sticks under a cause filter */}
        <span style={filterLabel}>Agent</span>
        {LANES.map((l) => (
          <button key={l.key} type="button" className={`fct-chip${lane === l.key ? ' fct-chip--active' : ''}`} onClick={() => setParam('lane', l.key)}>
            {l.label}
          </button>
        ))}
        <span style={{ ...filterLabel, marginLeft: 'auto' }}>Sort</span>
        {SORTS.map((s) => (
          <button key={s.key} type="button" className={`fct-chip${sort === s.key ? ' fct-chip--active' : ''}`} onClick={() => setParam('sort', s.key)}>
            {s.label}
          </button>
        ))}
      </div>

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
        <DataTable columns={columns} rows={rows} rowKey={(x) => x.id} />
        {rows.length === 0 && (
          // Empty state keeps the table shell in place — do not collapse it.
          <div style={{ padding: '13px 20px' }}>
            <span style={{ fontSize: 13, color: colors.textMuted }}>{rcEntry ? "No items in this entity's sample trace to that root cause" : selectedCauses.length > 1 ? 'No exceptions match these causes' : selectedCauses.length === 1 ? 'No exceptions match this cause' : 'Nothing needs you right now'}</span>
          </div>
        )}
      </section>
    </div>
  )
}
