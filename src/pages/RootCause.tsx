import { useContext, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEntity, listCauses, plantRoute, type ProcessKey } from '../api'
import { Bar, CrossProcessTrace, Eyebrow, FreshnessStamp } from '../components'
import { AssistantContext } from '../features/assistant/AssistantDrawer'
import { formatCr, formatRecurrence } from '../lib/format'
import { barHeights, colors, fonts, radius, spacing, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 20, gap: 14 }

function DriverRow({ name, pct, to }: { name: string; pct: number; to?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      {/* §7.24 — a plant row drills sideways to its counterparty page when one exists */}
      {to ? <Link to={to} style={{ flex: 1, color: colors.accentText, textDecoration: 'none' }}>{name}</Link> : <span style={{ flex: 1 }}>{name}</span>}
      <span style={{ width: 70, flexShrink: 0 }}>
        <Bar value={pct} max={100} height={barHeights.inlineMeter} />
      </span>
      <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, width: 36, textAlign: 'right' }}>{`${pct}%`}</span>
    </div>
  )
}

export function RootCause() {
  const { code, process, causeKey } = useParams()
  const assistant = useContext(AssistantContext)
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
    { label: 'RECURRENCE', value: formatRecurrence(cause.recurrence) },
    { label: 'CONCENTRATION', value: cause.concentration },
    // §15.4 — the share an agent can resolve without a human; P2P causes only, O2C nodes carry no such field
    ...(cause.agentResolvablePct != null ? [{ label: 'AGENT-RESOLVABLE', value: `${cause.agentResolvablePct}%` }] : []),
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Level 5 — Root cause</Eyebrow>
        <h1 style={titleStyle}>{proc === 'o2c' ? 'Why receivables keep ageing' : 'Why blocked invoices keep recurring'}</h1>
        {/* §8.7 — the cause register is read from SAP ECC */}
        <FreshnessStamp sources={['SAP ECC']} />
        {/* §11 — the root cause view poses its own question to the drawer */}
        <button type="button" className="fct-ask-btn" onClick={() => assistant?.ask(proc === 'o2c' ? 'What will DSO be at month-end?' : 'Why do blocked invoices keep recurring?')} style={{ alignSelf: 'flex-start', padding: '9px 14px', fontSize: 13 }}>{proc === 'o2c' ? 'Ask what DSO will be at month-end' : 'Ask why these keep recurring'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: spacing.gapCards, alignItems: 'start' }}>
        {/* Taxonomy — the selected row is driven by the :causeKey route param */}
        <section style={{ ...clay.frame, padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
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
              {/* §15.4 — the row-level share makes automatable vs eliminable causes comparable across the taxonomy */}
              {c.agentResolvablePct != null && (
                <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{`${c.agentResolvablePct}% agent`}</span>
              )}
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{`${c.sharePct}%`}</span>
            </Link>
          ))}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCards }}>
          {/* Primary root cause panel — everything reads from the selected CauseNode */}
          <section style={{ ...clay.cardAccent, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                // O2C rows are customer segments, not plants — only the P2P split drills on.
                <DriverRow key={d.name} name={d.name} pct={d.pct} to={proc === 'p2p' ? plantRoute(entity.code, d.name) : undefined} />
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
                  {/* accentText, not accent — the dash is text on a panel; raw accent fails AA in light */}
                  <span style={{ color: colors.accentText }}>—</span>
                  <span>{a}</span>
                </div>
              ))}
            </section>
          </div>

          {proc === 'p2p' && cause.key === 'missing-gr' && (
            // §8.10 — this screen is the first point of the cross-tower chain; the trace links out to the other three
            <CrossProcessTrace code={entity.code} current="gr" />
          )}
        </div>
      </div>
    </div>
  )
}
