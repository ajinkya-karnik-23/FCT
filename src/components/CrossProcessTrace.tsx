import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { rootCauseTo } from '../app/paths'
import { tag } from '../theme/clay'
import { colors, fonts } from '../theme/tokens'

// §8.10/§16.7 — the one demo path that crosses towers: a missing goods receipt in P2P blocks an invoice,
// understates the accrual in R2R and lands on the close exposure figure on the R2R cockpit — a real screen,
// not an anchor on the overview. Rendered at all four points so the chain is clickable from any of them;
// `current` marks the point you are standing on.
export type TraceNode = 'gr' | 'invoice' | 'accrual' | 'close'

const NODES: Array<{ key: TraceNode; label: string; to: (code: string) => string }> = [
  { key: 'gr', label: 'Missing goods receipt · P2P', to: () => rootCauseTo('missing-gr') },
  { key: 'invoice', label: 'Blocked invoice', to: (c) => `/entity/${c}/p2p/invoices?cause=missing-gr` },
  { key: 'accrual', label: 'Understated accrual · R2R', to: (c) => `/entity/${c}#fct-consequence` },
  { key: 'close', label: 'Close exposure', to: (c) => `/entity/${c}/r2r` },
]

const linkStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.06em', color: colors.accentText, textDecoration: 'none' }
const currentStyle: CSSProperties = { ...tag(colors.textPrimary, colors.bgSelected), fontSize: 10, letterSpacing: '0.06em' }

export function CrossProcessTrace({ code, current }: { code: string; current: TraceNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', color: colors.textFaint }}>{'CROSS-PROCESS TRACE'}</span>
      {NODES.map((n, i) => (
        <Fragment key={n.key}>
          {i > 0 && <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>{'→'}</span>}
          {n.key === current ? (
            <span className="fct-trace-current" style={currentStyle}>{n.label}</span>
          ) : (
            <Link to={n.to(code)} className="fct-trace-link" style={linkStyle}>{n.label}</Link>
          )}
        </Fragment>
      ))}
    </div>
  )
}
