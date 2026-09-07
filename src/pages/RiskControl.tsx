import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { agentGovernanceSummary, apControlEffectiveness, getControlSignals, governanceInterpretation, listAgents } from '../api'
import type { ControlCategory, ControlSignal } from '../api'
import { Eyebrow, FreshnessStamp } from '../components'
import { formatCr } from '../lib/format'
import { controlColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
// §7.8 — mono label style shared by the metric labels; same family as the read-only / CAPPED tags elsewhere.
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }

// §15.1 — the label every agent surface carries; nothing more. The governance slice is one of them.
const SIMULATED = 'Simulated data'

function SimTag() {
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.textMuted, border: `1px solid ${colors.borderDefault}`, padding: '2px 8px' }}>{SIMULATED}</span>
  )
}

// §7.8 — the five categories in spec order; labels composed at render time from the stored keys.
const CATEGORY_ORDER: Array<{ key: ControlCategory; label: string }> = [
  { key: 'payment', label: 'Payment integrity' },
  { key: 'authority', label: 'Authority integrity' },
  { key: 'system', label: 'System integrity' },
  { key: 'cutoff', label: 'Cut-off integrity' },
  { key: 'exposure', label: 'Undisclosed exposure' },
]

// §8.8 — demo-only access levels; the RESTRICTED marker is always visible, the toggle flips what it gates.
type AccessLevel = 'fc' | 'plant'

function severityTagStyle(severity: ControlSignal['severity']): CSSProperties {
  const c = controlColor(severity)
  return clay.tag(c)
}

export function RiskControl() {
  const [access, setAccess] = useState<AccessLevel>('fc')
  const signals = getControlSignals()
  const effectiveness = apControlEffectiveness()
  // §15.6 — the governance slice carries only what needs attention; volume and resolution rates stay on the Agents screen.
  const gov = agentGovernanceSummary()
  // Every live agent appears: a register evidences absence as well as presence, and the interpretation lines mark
  // what actually needs attention. Ordered by value acted on without review — the figure an auditor asks for first.
  const govRows = listAgents().filter((a) => a.status === 'live').sort((x, y) => (y.metrics!.valueActedOnWithoutReviewCr - x.metrics!.valueActedOnWithoutReviewCr) || (x.number - y.number))
  const visible = access === 'fc'

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Risk & control</h1>
        {/* §8.7 — mixed sources: SAP ECC for the signals, AP tool control log cited inline below */}
        <FreshnessStamp sources={['SAP ECC', 'AP tool control log']} />
      </div>

      {/* §8.8 — restricted content behind a visible marker; demo-only toggle flips it for the walkthrough */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', ...clay.cardRisk, padding: '12px 18px', flexDirection: 'row' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.08em', color: colors.statusRed }}>{'RESTRICTED — Financial Controller and above'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* textMuted, not textFaint — the strip sits on bgRiskSoft, where faint fails AA in light */}
          <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: colors.textMuted }}>{'DEMO ACCESS'}</span>
          {(['fc', 'plant'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setAccess(level)}
              style={clay.controlPill(access === level)}
            >
              {level === 'fc' ? 'FC AND ABOVE' : 'PLANT MANAGER'}
            </button>
          ))}
        </div>
      </div>

      {visible ? (
        <>
          {CATEGORY_ORDER.map(({ key, label }) => (
            <section key={key} style={cardStyle}>
              <Eyebrow style={typeScale.tableHeader}>{label}</Eyebrow>
              {signals.filter((s) => s.category === key).map((s) => (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ ...typeScale.body, color: colors.textPrimary }}>{s.title}</span>
                    <span style={severityTagStyle(s.severity)}>{s.severity.toUpperCase()}</span>
                  </div>
                  <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{s.detail}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
                    <span>{`value at risk ${s.valueAtRiskCr != null ? formatCr(s.valueAtRiskCr) : '—'}`}</span>
                    <span>{s.entityCode}</span>
                    <span>{`detected ${s.detectedOn}`}</span>
                  </div>
                </div>
              ))}
            </section>
          ))}

          {/* §15.6 — agent governance sits on Risk & control: exceptions and exposure only, not workforce performance.
              Each row drills into the agent's own record. */}
          <section data-fct-agent-governance style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <Eyebrow style={typeScale.tableHeader}>Agent governance</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* §15.1 — the slice is an agent surface; the honesty label repeats here */}
                <SimTag />
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{'exceptions and exposure only · source: agent action logs'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Delegation breaches'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{String(gov.delegationBreaches)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'every logged action stayed inside its delegation'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Reversals'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{String(gov.reversed)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${gov.reversed} of ${gov.actionsThisPeriod} actions this period`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Overrides by human'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{String(gov.overriddenByHuman)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${gov.overriddenByHuman} of ${gov.resolvedWithoutHuman} resolved without human`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Value acted on without human review'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{formatCr(gov.valueActedOnWithoutReviewCr)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`of ${formatCr(gov.valueActedOnCr)} acted on this period`}</span>
              </div>
            </div>
            {govRows.map((a) => {
              const m = a.metrics!
              // §15.6 — interpret the rate rather than just displaying it: rising override/reversal → the delegation
              // may be set wrong; rising escalation → the policy needs updating, not that the agent is failing.
              const interp = governanceInterpretation(a)
              return (
                <div key={a.id} data-fct-gov-row={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <Link to={`/agents/${a.id}`} style={{ ...typeScale.body, color: colors.accentText, textDecoration: 'none' }}>{a.name}</Link>
                    <div style={{ display: 'flex', gap: 24, fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
                      <span>{`breaches ${m.delegationBreaches}`}</span>
                      <span>{`reversed ${m.reversed}`}</span>
                      <span>{`overridden ${m.overriddenByHuman}`}</span>
                      <span>{m.valueActedOnWithoutReviewCr > 0 ? `without review ${formatCr(m.valueActedOnWithoutReviewCr)}` : 'without review —'}</span>
                    </div>
                  </div>
                  {interp && <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{interp}</p>}
                </div>
              )
            })}
          </section>

          {/* §7.8 item 6 — effectiveness of the AP automation tool's own controls; monitoring only, no duplicate checking here */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
              <Eyebrow style={typeScale.tableHeader}>Control effectiveness — AP automation</Eyebrow>
              {/* §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable */}
              <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{'read-only · source: AP tool control log'}</span>
            </div>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Duplicate check — override rate, YTD'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{`${effectiveness.duplicate.overrideRatePct.toFixed(1)}%`}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${effectiveness.duplicate.overriddenYtd} of ${effectiveness.duplicate.flaggedYtd} flagged overridden`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Three-way match — override rate, YTD'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{`${effectiveness.threeWayMatch.overrideRatePct.toFixed(1)}%`}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{`${effectiveness.threeWayMatch.overriddenYtd} of ${effectiveness.threeWayMatch.failedYtd} failed overridden`}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={monoLabelStyle}>{'Value prevented, YTD'}</span>
                <span style={{ ...typeScale.bigScore, color: colors.textPrimary }}>{formatCr(effectiveness.valuePreventedYtdCr)}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'payments stopped by these controls'}</span>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div style={{ ...cardStyle, alignItems: 'center', padding: 40 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.08em', color: colors.statusRed }}>{'RESTRICTED — Financial Controller and above'}</span>
          <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>This screen is restricted to the Financial Controller and above. Switch the demo access toggle back to FC AND ABOVE to view it.</p>
        </div>
      )}
    </div>
  )
}
