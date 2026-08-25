import { Link, useLocation } from 'react-router-dom'
import { getEntity } from '../api'
import { StatusDot } from '../components'
import { scoreColor } from '../theme/derive'
import { colors, fonts, layout, radius } from '../theme/tokens'
import { buildBreadcrumb, DEFAULT_ENTITY, entityCodeFromPath } from './routes'

export function TopBar({ drawerOpen, onToggleDrawer }: { drawerOpen: boolean; onToggleDrawer: () => void }) {
  const { pathname } = useLocation()
  const crumbs = buildBreadcrumb(pathname)
  const code = entityCodeFromPath(pathname) ?? DEFAULT_ENTITY
  const entity = getEntity(code)

  return (
    <header
      style={{
        height: layout.topBarHeight,
        flexShrink: 0,
        padding: '0 26px',
        background: colors.bgPanel,
        borderBottom: `1px solid ${colors.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <nav
        aria-label="Breadcrumb"
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.06em' }}
      >
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span aria-hidden style={{ color: colors.textMuted }}>›</span>}
            {c.to ? (
              <Link to={c.to} className="fct-crumb">
                {c.label}
              </Link>
            ) : (
              <span style={{ color: colors.textMuted }}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div aria-hidden style={{ width: 1, height: 22, background: colors.borderStrong }} />

      {entity && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot color={scoreColor(entity.score)} size={8} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{entity.name}</span>
          <span
            style={{
              border: `1px solid ${colors.borderStrong}`,
              padding: '3px 7px',
              fontFamily: fonts.mono,
              fontSize: 11,
              color: colors.textFaint,
            }}
          >
            {entity.code}
          </span>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>
          PERIOD AUG-2026 · DAY 4 OF CLOSE
        </span>
        <button
          type="button"
          onClick={onToggleDrawer}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '8px 13px',
            fontSize: 13,
            border: `1px solid ${drawerOpen ? colors.accent : colors.borderStrong}`,
            color: colors.textPrimary,
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: radius.dot, background: colors.accent }} />
          Ask the cockpit
        </button>
      </div>
    </header>
  )
}
