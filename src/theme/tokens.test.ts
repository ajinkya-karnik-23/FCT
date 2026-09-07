// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyTheme, dark, fonts, light, setStoredTheme, storedTheme, type Theme } from './tokens'

type ColorKey = keyof typeof dark

// The dark palette is a frozen baseline: any edit here is a deliberate product decision.
// Re-frozen for the clay graphite+amber system (design/clay-graphite) — derived and validated by script.
const FROZEN_DARK = {
  bgRoot: '#181512',
  bgPanel: '#1F1C19',
  bgPanelAlt: '#1C1916',
  bgRaised: '#292623',
  bgSelected: '#302D2A',
  bgAccentSoft: '#382C15',
  bgAccentPanel: '#272117',
  borderDefault: '#383531',
  borderSubtle: '#2E2B27',
  borderStrong: '#4A4743',
  borderAccent: '#7E5D1D',
  textPrimary: '#EAE7E4',
  textSecondary: '#C0BDBA',
  textMuted: '#A09E9B',
  textFaint: '#7F7D7A',
  textFaintest: '#62605D',
  accent: '#E6AC3D',
  accentText: '#E9B452',
  statusGreen: '#63D18F',
  statusAmber: '#E7B643',
  statusRed: '#FF7D7C',
  chartArOld: '#C8642A',
  ageingBarAlt: '#7DA2C9',
  bgAccentHover: '#4B3A1D',
  bgWarnSoft: '#312814',
  bgRiskSoft: '#361F1F',
  assistantBorder: '#383531',
  paletteScrim: 'rgba(10, 9, 8, 0.72)',
} as const

// Mirrors toKebab in tokens.ts — the var names are a CSS contract with index.css.
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// ---------- WCAG math (hex only; every role/surface below is #rrggbb) ----------
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`not a #rrggbb hex color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(fg: string, bg: string): number {
  const l1 = luminance(hexToRgb(fg))
  const l2 = luminance(hexToRgb(bg))
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// Colors used as text and the surfaces they can sit on. `accent` is excluded:
// only decorative aria-hidden glyphs use it as text (streaming cursor, em-dash).
const TEXT_ROLES: ColorKey[] = ['textPrimary', 'textSecondary', 'textMuted', 'textFaint', 'textFaintest', 'accentText', 'statusGreen', 'statusAmber', 'statusRed']
const SURFACES: ColorKey[] = ['bgRoot', 'bgPanel', 'bgPanelAlt', 'bgRaised', 'bgSelected', 'bgAccentSoft', 'bgAccentPanel']

// Pairs exempt from the 4.5 floor; surface '*' means every surface. The rationales
// are load-bearing — a future edit that removes the reason (or introduces one of
// these pairings in the UI) has to touch this table on purpose.
const EXEMPT: Record<Theme, Array<{ role: ColorKey; surface: ColorKey | '*'; why: string }>> = {
  dark: [
    { role: 'textFaint', surface: '*', why: 'frozen dark baseline — the faint tier ships as-is' },
    { role: 'textFaintest', surface: '*', why: 'sub-AA by design in both themes (footnote/timestamp tier)' },
  ],
  light: [
    { role: 'textFaintest', surface: '*', why: 'sub-AA by design in both themes (footnote/timestamp tier)' },
    // tuned so it is no weaker than dark on the same surface (guarded below); absolute AA here would merge the faint/muted tiers
    { role: 'textFaint', surface: 'bgRoot', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    { role: 'textFaint', surface: 'bgPanelAlt', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    { role: 'textFaint', surface: 'bgRaised', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    { role: 'textFaint', surface: 'bgSelected', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    { role: 'textFaint', surface: 'bgAccentSoft', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    { role: 'textFaint', surface: 'bgAccentPanel', why: 'no weaker than dark counterpart; AA unreachable without merging faint/muted' },
    // not co-located in the current UI — palette math only; revisit if this pairing is introduced
    { role: 'textMuted', surface: 'bgSelected', why: 'not co-located in current UI; palette math only' },
    { role: 'textMuted', surface: 'bgAccentSoft', why: 'not co-located in current UI; palette math only' },
    { role: 'statusAmber', surface: 'bgRaised', why: 'not co-located in current UI; palette math only' },
    { role: 'statusAmber', surface: 'bgSelected', why: 'not co-located in current UI; palette math only' },
    { role: 'statusAmber', surface: 'bgAccentSoft', why: 'not co-located in current UI; palette math only' },
    { role: 'statusAmber', surface: 'bgAccentPanel', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgRoot', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgPanelAlt', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgRaised', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgSelected', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgAccentSoft', why: 'not co-located in current UI; palette math only' },
    { role: 'statusRed', surface: 'bgAccentPanel', why: 'not co-located in current UI; palette math only' },
  ],
}

const isExempt = (theme: Theme, role: ColorKey, surface: ColorKey) =>
  EXEMPT[theme].some((e) => e.role === role && (e.surface === '*' || e.surface === surface))

describe('palette shape', () => {
  it('dark palette matches the frozen baseline exactly', () => {
    expect(dark).toEqual(FROZEN_DARK)
  })

  it('every value in both palettes is a #rrggbb hex or rgba() string', () => {
    const ok = (v: string) => /^#[0-9a-f]{6}$/i.test(v) || /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d+)\)$/.test(v)
    for (const [theme, pal] of Object.entries({ dark, light })) {
      const bad = Object.entries(pal).filter(([, v]) => !ok(v)).map(([k, v]) => `${k}=${v}`)
      expect(bad, `malformed values in ${theme}: ${bad.join(', ')}`).toEqual([])
    }
  })
})

describe('applyTheme var mapping', () => {
  for (const theme of ['light', 'dark'] as Theme[]) {
    it(`sets every palette var + font vars on <html> (${theme})`, () => {
      applyTheme(theme)
      const pal = theme === 'light' ? light : dark
      const style = document.documentElement.style
      for (const [key, value] of Object.entries(pal)) {
        expect(style.getPropertyValue(`--${kebab(key)}`), `--${kebab(key)}`).toBe(value)
      }
      expect(style.getPropertyValue('--font-sans')).toBe(fonts.sans)
      expect(style.getPropertyValue('--font-mono')).toBe(fonts.mono)
    })
  }
})

describe('persistence helpers', () => {
  it('defaults to dark and round-trips through localStorage', () => {
    localStorage.clear()
    expect(storedTheme()).toBe('dark')
    setStoredTheme('light')
    expect(localStorage.getItem('fct-theme')).toBe('light')
    expect(storedTheme()).toBe('light')
    localStorage.removeItem('fct-theme')
    expect(storedTheme()).toBe('dark')
  })
})

describe('contrast floor (WCAG AA)', () => {
  for (const theme of ['dark', 'light'] as Theme[]) {
    it(`${theme}: every non-exempt text/surface pair meets 4.5:1`, () => {
      const pal = theme === 'light' ? light : dark
      const fails: string[] = []
      for (const role of TEXT_ROLES) {
        for (const surface of SURFACES) {
          if (isExempt(theme, role, surface)) continue
          const r = ratio(pal[role], pal[surface])
          if (r < 4.5) fails.push(`${role} on ${surface}: ${r.toFixed(2)}:1`)
        }
      }
      expect(fails).toEqual([])
    })
  }

  it('light textFaint is no weaker than dark on any surface', () => {
    for (const surface of SURFACES) {
      const l = ratio(light.textFaint, light[surface])
      const d = ratio(dark.textFaint, dark[surface])
      expect(l, `${light.textFaint} on ${surface}: light ${l.toFixed(2)} < dark ${d.toFixed(2)}`).toBeGreaterThanOrEqual(d)
    }
  })

  it('status-tinted messaging surfaces keep status text readable (§7.10.1, §7.8, §7.9)', () => {
    // bgWarnSoft hosts statusAmber text in the UI (veto banner) — small mono type needs full AA in both themes.
    expect(ratio(dark.statusAmber, dark.bgWarnSoft)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(light.statusAmber, light.bgWarnSoft)).toBeGreaterThanOrEqual(4.5)
    // bgRiskSoft hosts statusRed text on the Risk & control screen (§7.8) — small mono type needs full AA in both themes.
    expect(ratio(dark.statusRed, dark.bgRiskSoft)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(light.statusRed, light.bgRiskSoft)).toBeGreaterThanOrEqual(4.5)
  })
})
