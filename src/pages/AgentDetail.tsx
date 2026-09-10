import type { CSSProperties } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getAgent } from '../api'
import { Eyebrow } from '../components'
import { colors, fonts, spacing, typeScale } from '../theme/tokens'
import { AgentRecord } from './Agents'

const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 22 }
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }
const cardStyle: CSSProperties = { border: `1px solid ${colors.borderDefault}`, background: colors.bgPanel, padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }

// §15.1 — the label every agent surface carries; nothing more.
const SIMULATED = 'Simulated data'

function SimTag() {
  return (
    <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.textMuted, border: `1px solid ${colors.borderDefault}`, padding: '2px 8px' }}>{SIMULATED}</span>
  )
}

// §15.7 — the agent's own record: delegation, supervisor, action log filtered to that agent, performance over time.
export function AgentDetail() {
  const { agentId } = useParams()
  const a = agentId ? getAgent(agentId) : undefined
  if (!a) return <Navigate to="/agents" replace />

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>Agents</Eyebrow>
        <h1 style={titleStyle}>{a.name}</h1>
        {/* §15.1 — every agent surface carries the honesty label */}
        <SimTag />
        <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0 }}>{`#${a.number} · ${a.type} · ${a.scope}`}</p>
      </div>

      <section data-fct-agent-detail={a.id} style={cardStyle}>
        <AgentRecord a={a} />
      </section>
    </div>
  )
}
