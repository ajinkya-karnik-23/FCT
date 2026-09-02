import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { StatusDot } from '../components'
import { colors, fonts, layout } from '../theme/tokens'
import { activeNavKey, entityCodeFromPath, NAV_ITEMS, RAIL_GROUPS } from './routes'

// §9.1 — the rail is six labelled groups; group labels are mono caps in textFaintest.
const groupLabelStyle: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 9,
  letterSpacing: '0.14em',
  color: colors.textFaintest,
  padding: '0 10px',
}

export function Rail({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation()
  const active = activeNavKey(pathname)
  const code = entityCodeFromPath(pathname)

  return (
    <nav
      aria-label="Primary"
      style={{
        width: layout.railWidth,
        flexShrink: 0,
        background: colors.bgPanel,
        borderRight: `1px solid ${colors.borderDefault}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '22px 22px 20px', borderBottom: `1px solid ${colors.borderDefault}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot color={colors.accent} size={8} pulse />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Finance Control Tower</span>
        </div>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: colors.textFaint,
          }}
        >
          Jubilant Pharmova
        </span>
      </div>

      {/* §9.1 — labelled groups; counterparty pages are drill-only and never appear here */}
      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {RAIL_GROUPS.map((group) => (
          <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={groupLabelStyle}>{group}</span>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
              <Link key={item.key} to={item.to(code)} className={`fct-nav-item${active === item.key ? ' fct-nav-item--active' : ''}`}>
                <span>{item.label}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{item.count ?? '—'}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          borderTop: `1px solid ${colors.borderDefault}`,
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <button type="button" className="fct-search-btn" onClick={onSearch}>
          <span>Search everything</span>
          <span className="fct-kbd">⌘K</span>
        </button>
      </div>
    </nav>
  )
}
