import type { CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { getEntity, listCauses, listStages } from '../api'
import { Eyebrow, FreshnessStamp, Metric, StageFlow } from '../components'
import { colors, fonts, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }

// §8.3 — close % trends per entity; the Kpi look (mono 26) is kept via valueStyle.
const kpiValueStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 26 }

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textFaint }}>{label}</span>
      <span style={{ ...kpiValueStyle, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

export function R2RCockpit() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  const stages = listStages('r2r', code)
  // Panels land in Step 26 — until then every stage card drills to the R2R root-cause taxonomy.
  const firstCause = listCauses('r2r')[0].key

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 2 — Process · Record to Report</Eyebrow>
          <h1 style={titleStyle}>Record to report, as one flow</h1>
          {/* §16.8 — stage figures read from SAP; breaks come from the reconciliation platform */}
          <FreshnessStamp sources={['SAP ECC', 'Reconciliation platform']} />
        </div>
        {entity && (
          <div style={{ display: 'flex', gap: 34 }}>
            <Metric label="Close" value={`${entity.metrics.closePercent.current}%`} trend={entity.metrics.closePercent} inverse={false} valueStyle={kpiValueStyle} />
            {/* §7.2 — open breaks tie to the rail count and the REC stage */}
            <Kpi label="Open breaks" value={`${entity.metrics.reconAgedBreaks}`} />
          </div>
        )}
      </div>

      <StageFlow stages={stages} to={`/entity/${code}/root-cause/r2r/${firstCause}`} />
    </div>
  )
}
