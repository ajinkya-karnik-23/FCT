import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { closeCalendar, getEntity, listStages } from '../api'
import type { CloseTask } from '../api'
import { DataTable, Eyebrow, FreshnessStamp, StatusDot, type Column } from '../components'
import { statusColor } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
// Headline figures use the tile scale directly — Metric mandates a trend sparkline these pages do not carry.
const metricLabel: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column' }

// §16.3 — task status words; colours are the token status set only.
const STATUS_STYLE: Record<CloseTask['status'], { label: string; color: string }> = {
  open: { label: 'OPEN', color: colors.textMuted },
  blocked: { label: 'BLOCKED', color: colors.statusAmber },
}

function StatusBadge({ status }: { status: CloseTask['status'] }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: s.color }}>
      <StatusDot size={7} color={s.color} />
      {s.label}
    </span>
  )
}

export function CloseCalendar() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Close calendar</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  // Every entity in the group carries a pinned §16.3 summary — the entity guard above makes both lookups total.
  const cal = closeCalendar(entity.code)!
  const sgn = listStages('r2r', entity.code).find((s) => s.step === 'SGN')!

  // Predicted vs committed, straight off the critical path: its furthest due day is the prediction — blocked tasks
  // included, since they still gate close (JBL's slip sits in a blocked accrual → trial balance → reporting pack chain).
  const slip = cal.predictedDay - cal.committedDay
  const slipText = slip > 0 ? `slips ${slip} day${slip === 1 ? '' : 's'} past committed` : slip < 0 ? `${-slip} day${slip === 1 ? '' : 's'} ahead of committed` : 'on schedule'

  const blockedCount = cal.tasks.filter((t) => t.status === 'blocked').length
  const cpCount = cal.tasks.filter((t) => t.onCriticalPath).length
  const sentCount = cal.tasks.filter((t) => t.escalation?.state === 'sent').length
  const timerCount = cal.tasks.filter((t) => t.escalation?.state === 'timer').length

  // A controller scans for stuck work first: blocked rows before open ones, earliest due day within each group.
  const rows = [...cal.tasks].sort(
    (a, b) => Number(b.status === 'blocked') - Number(a.status === 'blocked') || a.dueDay - b.dueDay || a.id.localeCompare(b.id),
  )

  const columns: Array<Column<CloseTask>> = [
    {
      header: 'Task',
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.onCriticalPath && <StatusDot size={6} color={colors.accent} />}
          <span>{t.name}</span>
        </div>
      ),
    },
    { width: '130px', header: 'Owner', render: (t) => t.owner },
    { align: 'right', width: '90px', header: 'Due', render: (t) => <span style={{ fontFamily: fonts.mono }}>{`Day ${t.dueDay}`}</span> },
    { width: '120px', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      width: '260px', header: 'Blocked by',
      render: (t) => t.blocker ? (
        <span style={{ fontSize: 12, color: colors.textSecondary }}>{`${t.blocker.name} · owned by ${t.blocker.owner}`}</span>
      ) : (
        <span style={{ color: colors.textFaint }}>—</span>
      ),
    },
    {
      width: '230px', header: 'Escalation',
      render: (t) => t.escalation ? (
        // §16.3 — one escalation model with the exception worklist: a pending timer, or sent and logged.
        t.escalation.state === 'sent' ? (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.statusRed }}>{`sent ${t.escalation.when} to ${t.escalation.to} — logged`}</span>
        ) : (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.statusAmber }}>{`escalates to ${t.escalation.to} ${t.escalation.when}`}</span>
        )
      ) : (
        <span style={{ color: colors.textFaint }}>—</span>
      ),
    },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 2 — Process · Record to Report</Eyebrow>
          <h1 style={titleStyle}>Close calendar</h1>
          {/* §8.7 — the close tracker is the card's source on the group view; same source here */}
          <FreshnessStamp sources={['Close tracker']} />
        </div>
      </div>

      <div data-fct-close-kpis style={{ display: 'flex', gap: 34, flexWrap: 'wrap' }}>
        {[
          { label: 'CLOSE', value: `${entity.metrics.closePercent.current}%`, sub: `${cal.completeCount} of ${cal.totalTasks} tasks complete` },
          { label: 'COMMITTED', value: `Day ${cal.committedDay}`, sub: 'group close standard' },
          { label: 'PREDICTED', value: `Day ${cal.predictedDay}`, red: slip > 0, sub: slipText },
          { label: 'OPEN TASKS', value: String(cal.openCount), sub: `${cal.totalTasks} in the pool` },
          { label: 'BLOCKERS', value: String(cal.blockerCount), red: true, sub: 'tasks that cannot proceed' },
        ].map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={metricLabel}>{m.label}</span>
            <span style={{ ...typeScale.tileValue, color: m.red ? colors.statusRed : undefined }}>{m.value}</span>
            <span style={{ fontSize: 11, color: colors.textMuted }}>{m.sub}</span>
          </div>
        ))}
      </div>

      <section data-fct-close-calendar style={{ ...cardStyle, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Attention slice — blocked tasks and the critical path</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`dot = on the critical path · named rows are the attention slice of ${cal.totalTasks} tasks`}</span>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(t) => t.id} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontSize: 12, color: colors.textMuted }}>
          <span>{`${blockedCount} blocked · ${cpCount} on the critical path`}</span>
          <span style={{ fontFamily: fonts.mono }}>{`${sentCount} escalation${sentCount === 1 ? '' : 's'} sent · ${timerCount} timer${timerCount === 1 ? '' : 's'} running`}</span>
        </div>
      </section>

      {/* §16.3 — sign-off is status only, read from the reconciliation platform; no preparer/reviewer workflow */}
      <section data-fct-close-signoff style={{ ...cardStyle, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <Eyebrow style={typeScale.tableHeader}>Sign-off — status only</Eyebrow>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{'read from the reconciliation platform'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot size={8} color={statusColor(sgn.status)} />
          <span style={{ ...typeScale.body, color: colors.textSecondary }}>{`SGN sign-off · ${sgn.inFlight} in flight · ${sgn.inException} outstanding`}</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: statusColor(sgn.status) }}>{sgn.status}</span>
        </div>
      </section>
    </div>
  )
}
