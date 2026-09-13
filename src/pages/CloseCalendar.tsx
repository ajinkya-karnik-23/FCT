import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { blockingTaskRoute, closeCalendar, getEntity, listStages, taskPanelRoute } from '../api'
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
      // A.c — the blocker is a sentence, not a value, so it sits as a sub-line under the task name at full column width
      // instead of its own clipped column. B.b — the name drills to the R2R panel holding the exceptions behind it;
      // B.a — the blocker drills to the entity whose close is doing the blocking (plain text where there is no such page).
      header: 'Task',
      render: (t) => {
        const panelTo = taskPanelRoute(entity.code, t)
        const blockerTo = blockingTaskRoute(t)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {t.onCriticalPath && <StatusDot size={6} color={colors.accent} />}
              {panelTo ? (
                <Link to={panelTo} style={{ color: colors.accentText, textDecoration: 'none' }}>{t.name}</Link>
              ) : (
                <span>{t.name}</span>
              )}
            </span>
            {t.blocker && (
              <span style={{ fontSize: 12, color: colors.textSecondary, minWidth: 0 }}>
                blocked by{' '}
                {blockerTo ? (
                  <Link to={blockerTo} style={{ color: colors.accentText, textDecoration: 'none' }}>{t.blocker.name}</Link>
                ) : (
                  t.blocker.name
                )}{' '}· owned by {t.blocker.owner}
              </span>
            )}
          </div>
        )
      },
    },
    { width: '130px', header: 'Owner', render: (t) => t.owner },
    { align: 'right', width: '90px', header: 'Due', render: (t) => <span style={{ fontFamily: fonts.mono }}>{`Day ${t.dueDay}`}</span> },
    { width: '120px', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      // Compact state only; the full record — what was sent, to whom, answered or not — is a detail column one click away.
      width: '170px', header: 'Escalation',
      render: (t) => t.escalation ? (
        // §16.3 — one escalation model with the exception worklist: a pending timer, or sent and logged.
        t.escalation.state === 'sent' ? (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.statusRed }}>{`sent ${t.escalation.when} · logged`}</span>
        ) : (
          <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.statusAmber }}>{`escalates ${t.escalation.when}`}</span>
        )
      ) : (
        <span style={{ color: colors.textFaint }}>—</span>
      ),
    },
    {
      // §16.6 — the R2R agent on this task in one of the worklist's four states; an empty lane where no agent covers it.
      width: '230px', header: 'Agent',
      render: (t) => {
        const l = t.agentLane
        if (!l) return <span style={{ color: colors.textFaint }}>—</span>
        if (l.state === 'working') return <span style={{ fontSize: 12, color: colors.accentText }}>{`working · ${l.detail}`}</span>
        if (l.state === 'escalated') return <span style={{ fontSize: 12, color: colors.statusRed }}>{`escalated — ${l.detail}`}</span>
        if (l.state === 'resolved') return <span style={{ fontSize: 12, color: colors.statusGreen }}>{`agent resolved · ${l.detail}`}</span>
        return <span style={{ fontSize: 12, color: colors.textMuted }}>{l.detail}</span> // never-automated
      },
    },
    {
      // §16.3 — the escalation record the cell drills to: what was sent, to whom, and whether the contact has acted.
      detail: true, header: 'Escalation record',
      render: (t) => t.escalation?.state === 'sent' ? (
        <span style={{ fontSize: 12 }}>{`“${t.escalation.message}” — to ${t.escalation.to}, ${t.escalation.answered ? 'answered' : 'awaiting reply'}`}</span>
      ) : t.escalation?.state === 'timer' ? (
        <span style={{ fontSize: 12, color: colors.textSecondary }}>{`will escalate to ${t.escalation.to} ${t.escalation.when}`}</span>
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
          {/* §8.7/§16.8 — the calendar is in-platform: it is this screen's dataset, not an external tool's feed */}
          <FreshnessStamp sources={['Close calendar']} />
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
