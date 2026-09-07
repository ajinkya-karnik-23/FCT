import { Link } from 'react-router-dom'
import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import { getCause, getInterfaceHealth, listDataQuality, listEntities } from '../api'
import type { DataQualityItem } from '../api'
import { Eyebrow, FreshnessStamp } from '../components'
import { formatCr } from '../lib/format'
import { interfaceColor, scoreColor } from '../theme/derive'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { ...clay.card, padding: 22, gap: 18 }
const monoLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.08em', color: colors.textMuted }

function healthTagStyle(status: 'on schedule' | 'delayed' | 'stale'): CSSProperties {
  const c = interfaceColor(status)
  return clay.tag(c)
}

// §7.27 — the four domains in spec order; check rows come from JGL (the pinned anchor entity).
const DOMAINS: Array<{ key: DataQualityItem['domain']; label: string }> = [
  { key: 'vendor', label: 'Vendor master' },
  { key: 'customer', label: 'Customer master' },
  { key: 'gl', label: 'General ledger' },
  { key: 'interface', label: 'Interfaces' },
]

export function DataQualityPage() {
  const entities = listEntities()
  const jglPan = listDataQuality('JGL', 'vendor').find((d) => d.check === 'Missing tax registration')!
  const cause = getCause('vendor-master')!

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={titleStyle}>Data quality</h1>
        {/* §8.7 — MDM checks and IDoc interface health, both read from SAP ECC */}
        <FreshnessStamp sources={['SAP ECC']} />
      </div>

      {DOMAINS.map(({ key, label }) => (
        <section key={key} style={cardStyle}>
          <Eyebrow style={typeScale.tableHeader}>{label}</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) repeat(6, 84px)', gap: '10px 12px' }}>
            <span />
            {entities.map((e) => (
              <div key={e.code} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={monoLabelStyle}>{e.code}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: scoreColor(e.dimensions.dataQuality) }}>{e.dimensions.dataQuality}</span>
              </div>
            ))}

            {listDataQuality('JGL', key).map((c) => (
              <Fragment key={c.check}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 8 }}>
                  <span style={{ ...typeScale.body, color: colors.textPrimary }}>{c.check}</span>
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{c.impact}</span>
                </div>
                {entities.map((e) => {
                  const cell = listDataQuality(e.code, key).find((d) => d.check === c.check)!
                  return (
                    <div key={e.code} style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 8, textAlign: 'center', fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>
                      {`${cell.failCount} / ${cell.totalCount}`}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>

          {key === 'interface' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {entities.map((e) => {
                const h = getInterfaceHealth(e.code)!
                const idocFails = listDataQuality(e.code, 'interface')[0].failCount
                return (
                  <div key={e.code} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px minmax(0, 1fr) 150px', gap: 12, alignItems: 'center', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 8 }}>
                    <span style={{ ...typeScale.body, color: colors.textPrimary }}>{e.code}</span>
                    <div><span className="fct-status-tag" style={healthTagStyle(h.status)}>{h.status.toUpperCase()}</span></div>
                    <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{`last successful run ${h.lastSuccessfulRun}`}</span>
                    <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, textAlign: 'right' }}>{`${idocFails} failed IDocs (7d)`}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}

      {/* §7.5/§7.27 — the link that makes this screen exist: master-data failures showing up as working capital */}
      <section style={cardStyle}>
        <Eyebrow style={typeScale.tableHeader}>{'Master data → working capital'}</Eyebrow>
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
          {`Missing tax registration on ${jglPan.failCount} of ${jglPan.totalCount} vendor records at JGL (${jglPan.impact.toLowerCase()}). The same master-data gap is the vendor-master cause: ${cause.sharePct}% of JGL's blocked AP, ${formatCr(cause.valueAtRisk)}.`}
        </p>
        <Link to="/entity/JGL/root-cause/p2p/vendor-master" style={{ ...typeScale.body, color: colors.accentText, textDecoration: 'none' }}>{'See the root-cause view →'}</Link>
      </section>
    </div>
  )
}
