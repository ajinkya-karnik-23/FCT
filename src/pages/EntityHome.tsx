import { useContext } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, listCauses } from '../api'
import { defaultRootCauseTo } from '../app/paths'
import { Bar, Eyebrow, StatusDot } from '../components'
import { AssistantContext } from '../features/assistant/AssistantDrawer'
import { formatCr } from '../lib/format'
import { scoreColor, statusWord } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const DIM_LABELS = ['Close', 'Control', 'Wk capital', 'Process', 'Service'] as const
// Prototype scaling: insight fill is sharePct * 2.6 % of the track width.
const INSIGHT_FILL_SCALE = 2.6

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }

export function EntityHome() {
  const { code } = useParams()
  const assistant = useContext(AssistantContext)
  const entity = getEntity(code ?? '')
  if (!entity) return <UnknownEntity code={code ?? ''} />

  const statusColor = scoreColor(entity.score)
  const word = statusWord(entity.score)

  const tiles = [
    { label: 'Cash unapplied', value: formatCr(entity.cashUnapplied), sub: '19 receipts', tone: colors.statusAmber, to: `/entity/${entity.code}/working-capital` },
    { label: 'AP blocked', value: formatCr(entity.apBlocked), sub: '327 invoices', tone: colors.statusRed, to: `/entity/${entity.code}/p2p` },
    { label: 'AR > 90 days', value: formatCr(entity.arOver90), sub: '41 customers', tone: colors.statusRed, to: `/entity/${entity.code}/working-capital` },
    { label: 'Close', value: `${entity.closePct}%`, sub: '7 blockers', tone: colors.statusAmber, to: `/entity/${entity.code}` },
    // No per-entity reconciliation field in the data model yet; static reference value.
    { label: 'Reconciliations', value: formatCr(14.3), sub: '18 aged breaks', tone: colors.statusRed, to: defaultRootCauseTo(entity.code) },
    { label: 'Controls', value: `${entity.controlBreaches} breaches`, sub: '12 high-risk JEs', tone: colors.statusAmber, to: defaultRootCauseTo(entity.code) },
  ]

  const issues = [
    { dot: colors.statusRed, label: 'AP blocked > 30 days', value: formatCr(entity.apBlocked), age: 'oldest 52 d', owner: 'Entity controller', to: `/entity/${entity.code}/p2p` },
    { dot: colors.statusRed, label: 'Overdue AR > 90 days', value: formatCr(entity.arOver90), age: 'oldest 148 d', owner: 'Collections lead', to: `/entity/${entity.code}/working-capital` },
    { dot: colors.statusAmber, label: 'Unapplied cash', value: formatCr(entity.cashUnapplied), age: 'oldest 22 d', owner: 'Cash application', to: `/entity/${entity.code}/working-capital` },
    { dot: colors.statusAmber, label: 'Reconciliation breaks', value: '18 items', age: 'oldest 61 d', owner: 'R2R tower', to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
    { dot: colors.statusAmber, label: 'High-risk manual journals', value: '12 JEs', age: 'this period', owner: 'Financial controller', to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
    { dot: colors.statusAmber, label: 'Overdue queries', value: '27 tickets', age: 'SLA breached', owner: 'Service delivery', to: `/entity/${entity.code}/p2p/invoices` },
  ]

  const insights = listCauses('p2p').slice(0, 3)

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 30 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 1 — Legal entity</Eyebrow>
          <h1 style={titleStyle}>{entity.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ ...typeScale.bigScore, color: statusColor }}>{entity.score}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textFaint }}>/100</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.12em', padding: '4px 9px', color: statusColor, border: `1px solid ${statusColor}55` }}>{word}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 96px)', gap: 14 }}>
            {entity.dims.map((d, i) => (
              <div key={DIM_LABELS[i]} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ fontSize: 11, color: colors.textMuted }}>{DIM_LABELS[i]}</span>
                <Bar value={d} max={100} color={scoreColor(d)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
        {tiles.map((t, i) => (
          <Link
            key={t.label}
            to={t.to}
            className="fct-table-row"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '18px 20px',
              borderRight: i < tiles.length - 1 ? `1px solid ${colors.borderDefault}` : undefined,
              color: colors.textPrimary,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 12, color: colors.textMuted }}>{t.label}</span>
            <span style={typeScale.tileValue}>{t.value}</span>
            <span style={{ fontSize: 12, color: t.tone }}>{t.sub}</span>
          </Link>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: spacing.gapCards }}>
        <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderDefault}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow style={typeScale.tableHeader}>Top issues requiring attention</Eyebrow>
            <Link to={`/entity/${entity.code}/p2p/invoices`} style={{ fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>Open worklist →</Link>
          </div>
          {issues.map((x) => (
            <Link
              key={x.label}
              to={x.to}
              className="fct-table-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '16px 1fr 110px 100px 150px',
                alignItems: 'center',
                gap: 12,
                padding: spacing.tableCellPadding,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                color: colors.textPrimary,
                textDecoration: 'none',
              }}
            >
              <StatusDot size={8} color={x.dot} />
              <span style={{ fontSize: 13 }}>{x.label}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' }}>{x.value}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>{x.age}</span>
              <span style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>{x.owner}</span>
            </Link>
          ))}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCards }}>
          <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow style={typeScale.tableHeader}>Root cause insights</Eyebrow>
              <Link to={defaultRootCauseTo(entity.code)} style={{ fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>Analyse →</Link>
            </div>
            {insights.map((c) => (
              <Link key={c.key} to={`/entity/${entity.code}/root-cause/p2p/${c.key}`} style={{ display: 'flex', flexDirection: 'column', gap: 7, color: colors.textPrimary, textDecoration: 'none' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{c.name}</span>
                  <span style={{ fontFamily: fonts.mono, color: colors.textMuted }}>{`${c.sharePct}%`}</span>
                </span>
                <Bar value={c.sharePct * INSIGHT_FILL_SCALE} max={100} />
              </Link>
            ))}
          </section>

          <section style={{ border: `1px solid ${colors.borderAccent}`, background: colors.bgAccentPanel, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow style={{ ...typeScale.tableHeader, color: colors.accentText }}>Recommended actions</Eyebrow>
            <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>₹4.2 cr working-capital release available by clearing GR compliance on 11 vendors.</p>
            <div style={{ display: 'flex', gap: 20, fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>
              <span>38 resolvable today</span>
              <span>3 systemic</span>
            </div>
            {/* Opens the AI drawer and asks the entity's amber question (spec/07). */}
            <button type="button" className="fct-ask-btn" onClick={() => assistant?.ask('Why is this entity showing amber?')} style={{ border: `1px solid ${colors.accent}`, color: colors.textPrimary, padding: '9px 12px', fontSize: 13, textAlign: 'center' }}>Ask why this entity is amber</button>
          </section>
        </div>
      </div>
    </div>
  )
}

function UnknownEntity({ code }: { code: string }) {
  return (
    <div style={pageStyle}>
      <Eyebrow>Entity health</Eyebrow>
      <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
      <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, maxWidth: 640, lineHeight: 1.55 }}>This entity code is not in the group.</p>
      <Link to="/" className="fct-link" style={{ display: 'flex', alignItems: 'baseline', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>Back to group view</Link>
    </div>
  )
}
