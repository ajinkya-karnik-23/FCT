import { Link } from 'react-router-dom'
import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import { listCompliance, listEntities } from '../api'
import type { ComplianceItem, Entity } from '../api'
import { FreshnessStamp } from '../components'
import { formatCr } from '../lib/format'
import { complianceColor, scoreColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }

function statusTagStyle(status: ComplianceItem['status']): CSSProperties {
  const c = complianceColor(status)
  return clay.tag(c)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDue(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

const rowCols = 'minmax(0, 1fr) minmax(0, 0.75fr) 112px 96px minmax(0, 0.6fr)'

// §7.26 — the chain that makes the overdue filing load-bearing: filing → compliance dimension → veto cap on the
// entity score. Every segment drills to the entity page where the score and its vetoes live.
function OverdueChain({ entity, overdue }: { entity: Entity; overdue: ComplianceItem }) {
  const activeVetoes = entity.vetoes.filter((v) => v.active)
  const binding = activeVetoes.reduce((a, b) => (b.cap < a.cap ? b : a))
  const gstVeto = entity.vetoes.find((v) => v.id === 'gstOverdue')!
  // The cap that binds is the tightest active veto — for JRP that is the bank-change cap, so say what actually caps.
  const capText =
    binding.id === 'gstOverdue'
      ? `entity score capped at ${binding.cap} by the overdue filing`
      : `entity score capped at ${binding.cap} — ${binding.reason} binds tighter than the GST/HST cap of ${gstVeto.cap}`

  const segStyle: CSSProperties = { color: colors.accentText, textDecoration: 'none' }
  return (
    <div style={{ ...clay.sunken, background: colors.bgRiskSoft, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Link to={`/entity/${entity.code}`} style={segStyle}>{`${overdue.obligation} · due ${formatDue(overdue.dueDate)} — overdue`}</Link>
      <span style={{ color: colors.textMuted }}>{'→'}</span>
      <Link to={`/entity/${entity.code}`} style={segStyle}>{`compliance dimension ${entity.dimensions.compliance}`}</Link>
      <span style={{ color: colors.textMuted }}>{'→'}</span>
      <Link to={`/entity/${entity.code}`} style={segStyle}>{capText}</Link>
    </div>
  )
}

export function CompliancePage() {
  const entities = listEntities()
  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Compliance</h1>
        {/* §8.7 — the register is read from SAP ECC */}
        <FreshnessStamp sources={['SAP ECC']} />
      </div>

      {entities.map((e) => {
        const rows = listCompliance(e.code).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        const overdue = rows.find((r) => r.status === 'overdue')
        return (
          <section key={e.code} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <span style={{ ...typeScale.body, color: colors.textPrimary }}>{`${e.code} · ${e.name}`}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: scoreColor(e.dimensions.compliance) }}>{`compliance ${e.dimensions.compliance}`}</span>
            </div>

            {overdue && <OverdueChain entity={e} overdue={overdue} />}

            <div style={{ display: 'grid', gridTemplateColumns: rowCols, gap: 12 }}>
              <span style={monoLabelStyle}>{'OBLIGATION'}</span>
              <span style={monoLabelStyle}>{'JURISDICTION'}</span>
              <span style={monoLabelStyle}>{'DUE'}</span>
              <span style={monoLabelStyle}>{'STATUS'}</span>
              <span style={{ ...monoLabelStyle, textAlign: 'right' }}>{'VALUE AT RISK'}</span>

              {rows.map((r) => (
                <Fragment key={r.obligation}>
                  <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, ...typeScale.body, color: colors.textPrimary }}>{r.obligation}</div>
                  <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{e.geography}</div>
                  <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{formatDue(r.dueDate)}</div>
                  <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10 }}>
                    <span className="fct-status-tag" style={statusTagStyle(r.status)}>{r.status.toUpperCase()}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 10, textAlign: 'right', fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>
                    {r.valueAtRiskCr !== undefined ? formatCr(r.valueAtRiskCr) : r.failCount !== undefined ? `${r.failCount} ${r.failureLabel ?? 'failures'}` : '—'}
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
