import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, listCauses, type ProcessKey } from '../api'
import { Bar, Eyebrow } from '../components'
import { formatCr } from '../lib/format'
import { barHeights, colors, fonts, radius, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }

function DriverRow({ name, pct }: { name: string; pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ flex: 1 }}>{name}</span>
      <span style={{ width: 70, flexShrink: 0 }}>
        <Bar value={pct} max={100} height={barHeights.inlineMeter} />
      </span>
      <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 36, textAlign: 'right' }}>{`${pct}%`}</span>
    </div>
  )
}

export function RootCause() {
  const { code, process, causeKey } = useParams()
  const entity = getEntity(code ?? '')
  if (!entity) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Root cause</Eyebrow>
        <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>This entity code is not in the group.</p>
        <Link to="/" className="fct-link" style={{ alignSelf: 'flex-start', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
          Back to group view
        </Link>
      </div>
    )
  }

  // The process and cause key travel as one pair; the cause is looked up inside this process's
  // taxonomy, so a cause from another taxonomy can't be paired with it.
  const proc: ProcessKey = process === 'o2c' ? 'o2c' : 'p2p'
  const taxonomy = listCauses(proc)
  const cause = taxonomy.find((c) => c.key === causeKey)
  if (!cause) {
    return (
      <div style={pageStyle}>
        <Eyebrow>Root cause</Eyebrow>
        <h1 style={titleStyle}>{`Unknown cause ${causeKey}`}</h1>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`The taxonomy is fixed — pick one of the ${taxonomy.length} ${proc.toUpperCase()} causes.`}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {taxonomy.map((c) => (
            <Link key={c.key} to={`/entity/${code}/root-cause/${proc}/${c.key}`} className="fct-link" style={{ padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>
              {c.name} — {`${c.sharePct}%`}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const metrics = [
    { label: 'VALUE AT RISK', value: formatCr(cause.valueAtRisk) },
    { label: 'AVG DELAY', value: `${cause.avgDelayDays} days` },
    { label: 'RECURRENCE', value: cause.recurrence },
    { label: 'CONCENTRATION', value: cause.concentration },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Level 5 — Root cause</Eyebrow>
        <h1 style={titleStyle}>{proc === 'o2c' ? 'Why receivables keep ageing' : 'Why blocked invoices keep recurring'}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: spacing.gapCards, alignItems: 'start' }}>
        {/* Taxonomy — the selected row is driven by the :causeKey route param */}
        <section style={{ border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.borderDefault}` }}>
            <Eyebrow style={typeScale.tableHeader}>{`Taxonomy — ${proc.toUpperCase()}`}</Eyebrow>
          </div>
          {taxonomy.map((c) => (
            <Link
              key={c.key}
              to={`/entity/${code}/root-cause/${proc}/${c.key}`}
              className={c.key === cause.key ? 'fct-tax-row fct-tax-row--selected' : 'fct-tax-row'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '13px 18px',
                borderBottom: `1px solid ${colors.borderSubtle}`,
                fontSize: 13,
                color: c.key === cause.key ? colors.textPrimary : colors.textMuted,
                textDecoration: 'none',
              }}
            >
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${c.sharePct}%`}</span>
            </Link>
          ))}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCards }}>
          {/* Primary root cause panel — everything reads from the selected CauseNode */}
          <section style={{ border: `1px solid ${colors.borderAccent}`, background: colors.bgAccentPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: radius.dot, background: colors.accent }} />
              <Eyebrow style={{ ...typeScale.tableHeader, color: colors.accentText }}>{`Primary root cause — ${cause.name}`}</Eyebrow>
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: colors.textPrimary, maxWidth: 1100, margin: 0, textWrap: 'pretty' }}>{cause.narrative}</p>
            <div style={{ display: 'flex', gap: 34, paddingTop: 6 }}>
              {metrics.map((m) => (
                <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{m.label}</span>
                  <span style={{ fontFamily: fonts.mono, fontSize: 22 }}>{m.value}</span>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.gapCards }}>
            <section style={cardStyle}>
              <Eyebrow style={typeScale.tableHeader}>{proc === 'o2c' ? 'By customer segment' : 'By plant'}</Eyebrow>
              {cause.plants.map((d) => (
                <DriverRow key={d.name} name={d.name} pct={d.pct} />
              ))}
            </section>

            <section style={cardStyle}>
              <Eyebrow style={typeScale.tableHeader}>{proc === 'o2c' ? 'By driver' : 'By vendor group'}</Eyebrow>
              {cause.vendors.map((d) => (
                <DriverRow key={d.name} name={d.name} pct={d.pct} />
              ))}
            </section>

            <section style={cardStyle}>
              <Eyebrow style={typeScale.tableHeader}>Recommended intervention</Eyebrow>
              {cause.actions.map((a) => (
                <div key={a} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.45, color: colors.textSecondary }}>
                  <span style={{ color: colors.accent }}>—</span>
                  <span>{a}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
