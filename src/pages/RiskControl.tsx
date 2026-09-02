import { useState } from 'react'
import type { CSSProperties } from 'react'
import { apControlEffectiveness, getControlSignals } from '../api'
import type { ControlCategory, ControlSignal } from '../api'
import { Eyebrow, FreshnessStamp } from '../components'
import { formatCr } from '../lib/format'
import { controlColor } from '../theme/derive'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }
// §7.8 — mono label style shared by the metric labels; same family as the read-only / CAPPED tags elsewhere.
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }

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
  return { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', padding: '3px 6px', border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap' }
}

export function RiskControl() {
  const [access, setAccess] = useState<AccessLevel>('fc')
  const signals = getControlSignals()
  const effectiveness = apControlEffectiveness()
  const visible = access === 'fc'

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Risk & control</Eyebrow>
        <h1 style={titleStyle}>Everything the auditor will find, ninety days earlier.</h1>
        {/* §8.7 — mixed sources: SAP ECC for the signals, AP tool control log cited inline below */}
        <FreshnessStamp sources={['SAP ECC', 'AP tool control log']} />
      </div>

      {/* §8.8 — restricted content behind a visible marker; demo-only toggle flips it for the walkthrough */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', border: `1px solid ${colors.statusRed}`, background: colors.bgRiskSoft, padding: '12px 18px' }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.08em', color: colors.statusRed }}>{'RESTRICTED — Financial Controller and above'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* textMuted, not textFaint — the strip sits on bgRiskSoft, where faint fails AA in light */}
          <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: colors.textMuted }}>{'DEMO ACCESS'}</span>
          {(['fc', 'plant'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setAccess(level)}
              style={{ border: `1px solid ${access === level ? colors.accent : colors.borderStrong}`, padding: '3px 7px', fontFamily: fonts.mono, fontSize: 10, color: access === level ? colors.textPrimary : colors.textMuted, background: 'transparent', cursor: 'pointer' }}
            >
              {level === 'fc' ? 'FC AND ABOVE' : 'PLANT MANAGER'}
            </button>
          ))}
        </div>
      </div>

      {/* §1 — no duplication: where a source system enforces a control, this platform monitors it rather than re-running it */}
      <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{`Where the source system already enforces a control, this platform does not re-run it — it monitors the control's effectiveness and any bypass of it. Control of the control, not a second control.`}</p>

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
