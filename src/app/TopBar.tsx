import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { computeScore, getEntity } from '../api'
import { StatusDot } from '../components'
import { controlPill, pillButton, pillButtonAccent, tag } from '../theme/clay'
import { scoreColor } from '../theme/derive'
import { applyTheme, colors, fonts, layout, radius, setStoredTheme, storedTheme, type Theme } from '../theme/tokens'
import { COCKPIT_MODES, MODE_PERIOD, useAppMode } from './mode'
import { buildBreadcrumb, DEFAULT_ENTITY, entityCodeFromPath } from './routes'

export function TopBar({ drawerOpen, onToggleDrawer }: { drawerOpen: boolean; onToggleDrawer: () => void }) {
  const { pathname } = useLocation()
  const [theme, setTheme] = useState<Theme>(storedTheme())
  const { mode, setMode } = useAppMode()

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setStoredTheme(next)
    setTheme(next)
  }
  const crumbs = buildBreadcrumb(pathname)
  const code = entityCodeFromPath(pathname) ?? DEFAULT_ENTITY
  const entity = getEntity(code)
  // §10 — colour must never be the only carrier of meaning; the dot is read with its score.
  const score = entity ? computeScore(entity) : null

  return (
    <header
      style={{
        height: layout.topBarHeight,
        flexShrink: 0,
        padding: '0 26px',
        background: colors.bgRoot,
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

      {entity && score && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot color={scoreColor(score.displayed)} size={8} />
          <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 700, color: scoreColor(score.displayed) }}>{score.displayed}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{entity.name}</span>
          <span style={{ ...tag(colors.textMuted), fontSize: 11 }}>{entity.code}</span>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* §8.5 — demo mode switcher, labelled as a demo control. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.08em', color: colors.textFaint, marginRight: 4 }}>DEMO MODE</span>
          {COCKPIT_MODES.map((m) => (
            <button key={m.id} type="button" className="fct-press" onClick={() => setMode(m.id)} style={controlPill(mode === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>PERIOD AUG-2026 · {MODE_PERIOD[mode]}</span>
        <button type="button" className="fct-press" onClick={toggleTheme} style={controlPill(false)}>
          {theme === 'dark' ? 'DARK MODE' : 'LIGHT MODE'}
        </button>
        <button type="button" className="fct-press" onClick={onToggleDrawer} style={drawerOpen ? pillButtonAccent : pillButton}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: radius.dot, background: drawerOpen ? '#FFFFFF' : colors.accent }} />
          Ask the cockpit
        </button>
      </div>
    </header>
  )
}
