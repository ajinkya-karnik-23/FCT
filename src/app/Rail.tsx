import { Link, useLocation } from 'react-router-dom'
import { StatusDot } from '../components'
import { colors, fonts, layout } from '../theme/tokens'
import { activeNavKey, entityCodeFromPath, NAV_ITEMS } from './routes'

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
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Controller Cockpit</span>
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
          Finance Control Tower
        </span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <Link to={item.to(code)} className={`fct-nav-item${active === item.key ? ' fct-nav-item--active' : ''}`}>
              <span>{item.label}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{item.count ?? '—'}</span>
            </Link>
          </li>
        ))}
      </ul>

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
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: colors.textFaintest,
          }}
        >
          Jubilant Pharmova
        </span>
      </div>
    </nav>
  )
}
