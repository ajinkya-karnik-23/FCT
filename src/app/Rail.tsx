import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { colors, fonts, layout, radius, shadows } from '../theme/tokens'
import { activeNavKey, entityCodeFromPath, NAV_ITEMS, RAIL_GROUPS } from './routes'

// §9.1 — the rail is six labelled groups; group labels are mono caps in textFaintest.
const groupLabelStyle: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 9,
  letterSpacing: '0.14em',
  color: colors.textFaintest,
  padding: '0 14px',
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
        background: colors.bgPanelAlt,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '22px 20px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Raised amber mark — the one place the brand takes the accent as a fill */}
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: radius.sm + 2, background: colors.accent, boxShadow: shadows.upSm, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontFamily: fonts.mono, fontSize: 12, fontWeight: 700 }}>FC</span>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>Finance Control Tower</span>
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
      <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        {RAIL_GROUPS.map((group) => (
          <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={groupLabelStyle}>{group}</span>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
              <Link key={item.key} to={item.to(code)} className={`fct-nav-item${active === item.key ? ' fct-nav-item--active' : ''}`}>
                <span>{item.label}</span>
                <span className="fct-nav-count" style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{item.count ?? '—'}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '18px 20px 22px',
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
