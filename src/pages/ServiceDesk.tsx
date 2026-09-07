import { useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { deflection, effectiveAgeDays, listEntities, listRequests, requestAgeDays, requestOwnerPool, requestSlaStatus, serviceDeskWindow } from '../api'
import type { Request } from '../api'
import { DataTable, Eyebrow, FreshnessStamp } from '../components'
import type { Column } from '../components'
import { requestSlaColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }
const dimStyle: CSSProperties = { color: colors.textFaint }

// §7.29 — the six request types that make up "every request into the service"; display labels only, the dataset
// keeps the machine names (types.ts).
const REQUEST_TYPES: Request['type'][] = ['query', 'dispute', 'masterData', 'fixedAsset', 'priceChange', 'urgentPayment']
const TYPE_LABEL: Record<Request['type'], string> = {
  query: 'Query',
  dispute: 'Dispute',
  masterData: 'Master data',
  fixedAsset: 'Fixed asset',
  priceChange: 'Price change',
  urgentPayment: 'Urgent payment',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatRaised(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

function p2(n: number): string {
  return String(n).padStart(2, '0')
}

// §7.29 — the new-request form writes to local state only (the demo has no backend); a submitted row enters the
// queue as open with its SLA clock starting now — which is exactly what the desk exists to give it.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
      <span style={monoLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = { ...clay.sunken, background: colors.bgPanel, border: 'none', padding: '10px 14px', fontSize: 13, color: colors.textPrimary, outline: 'none' }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.1em', color: colors.textFaint }}>{label}</span>
      <span style={{ ...typeScale.kpiValue, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

interface DeflectionRow {
  code: string
  selfServed: number
  routed: number
  ratePct: number
  group: boolean
}

export function ServiceDesk() {
  const entities = listEntities()
  const [sessionRows, setSessionRows] = useState<Request[]>([])
  const [entityCode, setEntityCode] = useState(entities[0].code)
  const [type, setType] = useState<Request['type']>('query')
  const [raisedBy, setRaisedBy] = useState('')
  const [category, setCategory] = useState('')

  // Queue = seeded rows + this session's submissions, oldest effective age first (§5: stop-clock hours already subtracted).
  const queue = [...listRequests(), ...sessionRows].sort((a, b) => effectiveAgeDays(b) - effectiveAgeDays(a))
  const openRows = queue.filter((r) => r.status !== 'closed')
  const oldest = Math.round(openRows.reduce((m, r) => Math.max(m, effectiveAgeDays(r)), 0) * 10) / 10
  const stoppedHours = queue.reduce((s, r) => s + r.clockStoppedHours, 0)
  const groupDeflection = deflection()
  const deskWindow = serviceDeskWindow()

  function addRequest(e: FormEvent) {
    e.preventDefault()
    const now = new Date()
    // Step 14 carry-over — a fresh intake gets a named owner from the entity's §7.17 pool (round-robin across this
    // session's submissions for that entity), not 'Unassigned': an anonymous queue is the accountability gap the
    // platform exists to close.
    const pool = requestOwnerPool(entityCode)
    const mine = sessionRows.filter((r) => r.entityCode === entityCode).length
    setSessionRows((rows) => [
      ...rows,
      {
        id: `REQ-${entityCode}-S${String(rows.length + 1).padStart(3, '0')}`,
        type,
        entityCode,
        raisedBy: raisedBy.trim() || 'Unspecified',
        // Local date parts, same shape as the seeded rows — the SLA clock starts on this calendar day (§7.21).
        raisedOn: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}T${p2(now.getHours())}:${p2(now.getMinutes())}:00`,
        category: category.trim() || TYPE_LABEL[type],
        owner: pool[mine % pool.length],
        status: 'open',
        clockStoppedHours: 0,
      },
    ])
  }

  const queueColumns: Array<Column<Request>> = [
    { header: 'Entity', width: '76px', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{r.entityCode}</span> },
    { header: 'Type', width: '120px', render: (r) => TYPE_LABEL[r.type] },
    { header: 'Category', render: (r) => <span style={{ color: colors.textSecondary }}>{r.category}</span> },
    { header: 'Raised by', width: '130px', render: (r) => r.raisedBy },
    { header: 'Raised on', detail: true, render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{formatRaised(r.raisedOn)}</span> },
    { header: 'Age d', width: '80px', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{requestAgeDays(r)}</span> },
    // §5's attribution logic applied to requests — the hours the clock stood still while awaiting the client.
    { header: 'Stopped h', detail: true, render: (r) => (r.clockStoppedHours > 0 ? <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{r.clockStoppedHours}</span> : <span style={dimStyle}>—</span>) },
    { header: 'Owner', width: '140px', render: (r) => r.owner },
    { header: 'Status', width: '150px', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12, color: r.status === 'closed' ? colors.textFaint : colors.textSecondary }}>{r.status.toUpperCase()}</span> },
    {
      header: 'SLA status',
      width: '110px',
      render: (r) => {
        const w = requestSlaStatus(r)
        // No committed TAT for this type — a dimmed dash, not an invented target.
        return w ? <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.08em', color: requestSlaColor(w) }}>{w.toUpperCase()}</span> : <span title="No committed TAT for this type" style={dimStyle}>—</span>
      },
    },
  ]

  const deflectionRows: DeflectionRow[] = [
    ...entities.map((e) => ({ code: e.code, ...deflection(e.code), group: false })),
    { code: 'GROUP', ...groupDeflection, group: true },
  ]
  const deflectionColumns: Array<Column<DeflectionRow>> = [
    { header: 'Entity', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12, color: r.group ? colors.textPrimary : colors.textSecondary }}>{r.code}</span> },
    { header: 'Self-served', width: '130px', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{r.selfServed}</span> },
    { header: 'Routed to the service team', width: '200px', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{r.routed}</span> },
    { header: 'Self-serve share', width: '140px', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontSize: 12 }}>{`${r.ratePct}%`}</span> },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Finance Service Desk</h1>
        {/* §8.7 — every figure on this screen comes from the service metrics feed */}
        <FreshnessStamp sources={['service metrics']} />
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{`measuring since ${deskWindow.measuringSince} · first full-period report from ${deskWindow.nextPeriod}`}</span>
      </div>

      {/* Live current-period-to-date figures — derived at read time, never stored */}
      <div style={{ display: 'flex', gap: 40 }}>
        <Stat label="OPEN REQUESTS" value={String(openRows.length)} />
        <Stat label="OLDEST EFFECTIVE AGE" value={`${oldest} d`} />
        <Stat label="STOP-CLOCK HOURS" value={String(stoppedHours)} />
        <Stat label="SELF-SERVE SHARE" value={`${groupDeflection.ratePct}%`} />
      </div>

      {/* §7.29 — one intake for six request types; local state only, the queue resets on reload */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>New request</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>demo · writes to local state only</span>
        </div>
        <form onSubmit={addRequest} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <Field label="ENTITY">
            <select className="fct-input" value={entityCode} onChange={(e) => setEntityCode(e.target.value)} style={inputStyle}>
              {entities.map((e) => (
                <option key={e.code} value={e.code}>{e.code}</option>
              ))}
            </select>
          </Field>
          <Field label="TYPE">
            <select className="fct-input" value={type} onChange={(e) => setType(e.target.value as Request['type'])} style={inputStyle}>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="RAISED BY">
            <input className="fct-input" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)} placeholder="Client role, e.g. Plant stores" style={inputStyle} />
          </Field>
          <Field label="CATEGORY">
            <input className="fct-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="What is it about?" style={inputStyle} />
          </Field>
          <button type="submit" className="fct-escalate-btn" style={{ padding: '10px 16px', fontSize: 13, color: colors.textPrimary }}>Add to queue</button>
        </form>
      </section>

      {/* The queue — every request into the service, oldest effective age first */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Queue</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${queue.length} requests · ${openRows.length} open`}</span>
        </div>
        <DataTable columns={queueColumns} rows={queue} rowKey={(r) => r.id} />
      </section>

      {/* §7.29 — deflection counter: self-service versus the service team; carries into Step 16's operating-model argument */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Deflection</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>requests answered by self-service versus routed to the service team</span>
        </div>
        <DataTable columns={deflectionColumns} rows={deflectionRows} rowKey={(r) => r.code} />
      </section>
    </div>
  )
}
