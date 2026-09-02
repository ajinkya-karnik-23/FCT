import type { CSSProperties } from 'react'

// The two palettes are the only place hex/rgba values live in the product.
export const dark = {
  bgRoot: '#080B10',
  bgPanel: '#0B1017',
  bgPanelAlt: '#0A0F16',
  bgRaised: '#101822',
  bgSelected: '#121C27',
  bgAccentSoft: '#12233C',
  bgAccentPanel: '#0D1522',
  borderDefault: '#182231',
  borderSubtle: '#131C27',
  borderStrong: '#22303F',
  borderAccent: '#2A3A52',
  textPrimary: '#E6ECF4',
  textSecondary: '#B9C6D6',
  textMuted: '#8798AC',
  textFaint: '#5C7290',
  textFaintest: '#4A5F7A',
  accent: '#2E7DF0',
  accentText: '#56A0FF',
  statusGreen: '#35C48A',
  statusAmber: '#F2B23E',
  statusRed: '#FF6B6B',
  chartArOld: '#B4551E',
  ageingBarAlt: '#1F5FB5', // non-dominant buckets in the blocked-invoice ageing chart (spec/05)
  bgAccentHover: '#17304F', // hover fill for accent-bordered buttons (spec/05)
  bgWarnSoft: '#352D1E', // statusAmber-tinted surface: amber blended ~18% into the panel, same relationship as bgAccentSoft/accent (§7.10.1, §7.8)
  bgRiskSoft: '#372026', // statusRed-tinted surface, same blend as bgWarnSoft (§7.9)
  assistantBorder: '#1B2634', // assistant bubbles + preset buttons (spec/07)
  paletteScrim: 'rgba(4, 7, 11, 0.72)', // command-palette backdrop (spec/07)
} as const

export type Palette = Record<keyof typeof dark, string>

export const light: Palette = {
  bgRoot: '#F2F5F9',
  bgPanel: '#FFFFFF',
  bgPanelAlt: '#F7F9FC',
  bgRaised: '#EAEFF5',
  bgSelected: '#E3EAF3',
  bgAccentSoft: '#DFEAFB',
  bgAccentPanel: '#EEF4FC',
  borderDefault: '#D6DEE9',
  borderSubtle: '#E4EAF2',
  borderStrong: '#B7C4D4',
  borderAccent: '#9FBCE8',
  textPrimary: '#16222F',
  textSecondary: '#3E5169',
  textMuted: '#5A6E86',
  // #64788F keeps the faint tier below muted (5.24 vs 4.54 on white) while clearing AA on panel/root
  textFaint: '#64788F',
  textFaintest: '#93A3B5',
  accent: '#2E7DF0',
  accentText: '#1D5ED8',
  // darkened so status labels clear AA on white (5.62) — the bright dark-theme green cannot work on light bgs
  statusGreen: '#14764F',
  statusAmber: '#A16207',
  // darkened so red text clears small-text AA on bgRiskSoft as well, not just white (§7.8, §10)
  statusRed: '#C22E2E',
  chartArOld: '#B4551E', // mid-tone reads on both themes
  ageingBarAlt: '#1F5FB5', // mid-tone reads on both themes
  bgAccentHover: '#CFE0F8',
  // Paler than the dark-theme blend on purpose: light statusAmber/statusRed are already
  // darkened to clear AA on white, so a stronger tint would drop their text below 4.5:1.
  bgWarnSoft: '#F9F6F0', // pale amber-tinted surface; keeps statusAmber text ≥4.5:1 (AA) on it (§7.10.1, §7.8)
  bgRiskSoft: '#FCF3F3', // pale red-tinted surface, same blend as bgWarnSoft (§7.9)
  assistantBorder: '#D9E2EE',
  paletteScrim: 'rgba(23, 32, 45, 0.55)',
}

export type Theme = 'dark' | 'light'

const palettes: Record<Theme, Palette> = { dark, light }

// Components read colors.*; each value is a CSS variable so the active theme
// resolves at paint time — switching themes needs no React re-render. The
// satisfies check keeps these keys in lockstep with the palette objects.
export const colors = {
  bgRoot: 'var(--bg-root)',
  bgPanel: 'var(--bg-panel)',
  bgPanelAlt: 'var(--bg-panel-alt)',
  bgRaised: 'var(--bg-raised)',
  bgSelected: 'var(--bg-selected)',
  bgAccentSoft: 'var(--bg-accent-soft)',
  bgAccentPanel: 'var(--bg-accent-panel)',
  borderDefault: 'var(--border-default)',
  borderSubtle: 'var(--border-subtle)',
  borderStrong: 'var(--border-strong)',
  borderAccent: 'var(--border-accent)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textFaint: 'var(--text-faint)',
  textFaintest: 'var(--text-faintest)',
  accent: 'var(--accent)',
  accentText: 'var(--accent-text)',
  statusGreen: 'var(--status-green)',
  statusAmber: 'var(--status-amber)',
  statusRed: 'var(--status-red)',
  chartArOld: 'var(--chart-ar-old)',
  ageingBarAlt: 'var(--ageing-bar-alt)',
  bgAccentHover: 'var(--bg-accent-hover)',
  bgWarnSoft: 'var(--bg-warn-soft)',
  bgRiskSoft: 'var(--bg-risk-soft)',
  assistantBorder: 'var(--assistant-border)',
} as const satisfies Record<Exclude<keyof typeof dark, 'paletteScrim'>, string>

export type ColorName = keyof typeof colors

export const fonts = {
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const

// Spec gives ranges for some scales; the canonical value is used unless a view overrides it.
export const typeScale = {
  viewTitle: { fontSize: '26px', fontWeight: fontWeights.semibold, letterSpacing: '-0.02em', fontFamily: fonts.sans },
  bigScore: { fontSize: '44px', fontWeight: fontWeights.semibold, lineHeight: 1, fontFamily: fonts.mono },
  kpiValue: { fontSize: '30px', fontWeight: fontWeights.semibold, fontFamily: fonts.mono },
  tileValue: { fontSize: '22px', fontWeight: fontWeights.semibold, fontFamily: fonts.mono },
  stageVolume: { fontSize: '19px', fontWeight: fontWeights.regular, fontFamily: fonts.mono },
  body: { fontSize: '13px', fontWeight: fontWeights.regular, fontFamily: fonts.sans },
  uiBase: { fontSize: '14px', fontWeight: fontWeights.regular, fontFamily: fonts.sans },
  eyebrow: {
    fontSize: '11px',
    fontWeight: fontWeights.regular,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: colors.textFaint,
    fontFamily: fonts.mono,
  },
  tableHeader: {
    fontSize: '10px',
    fontWeight: fontWeights.regular,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: colors.textFaint,
    fontFamily: fonts.mono,
  },
} satisfies Record<string, CSSProperties>

export type TypeScaleName = keyof typeof typeScale

export const spacing = {
  contentPadding: '30px 26px 40px',
  cardPadding: '22px',
  tableCellPadding: '14px 20px',
  gapCards: '16px',
  gapStages: '10px',
  gapCardInner: '12px',
} as const

export const layout = {
  railWidth: '236px',
  topBarHeight: '60px',
  aiDrawerWidth: '470px',
  paletteWidth: '720px',
  paletteTopOffset: '12vh',
  paletteScrim: 'var(--palette-scrim)',
} as const

export const radius = {
  none: 0, // everything except status dots
  dot: '50%', // the only round shape in the product
} as const

export const barHeights = {
  stageRate: 4,
  inlineMeter: 6,
  ageing: 18,
  dimensionColumn: 22,
} as const

export const animation = {
  pulse: 'pulse 2.4s ease-in-out infinite',
  fadeIn: 'fade-in 140ms ease-out',
} as const

// The only shadow in the product; reserved for the command palette. Same value in both themes.
export const paletteShadow = '0 40px 100px -30px rgba(0, 0, 0, 0.9)'

function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

// Built from the palette objects — never from `colors`, whose values are the
// variables themselves (deriving from them would be circular).
const themeVariables = (theme: Theme): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(palettes[theme]).map(([name, value]) => [`--${toKebab(name)}`, value]),
  ),
  '--font-sans': fonts.sans,
  '--font-mono': fonts.mono,
})

export function applyTheme(theme: Theme = 'dark'): void {
  const style = document.documentElement.style
  for (const [name, value] of Object.entries(themeVariables(theme))) {
    style.setProperty(name, value)
  }
}

const THEME_STORAGE_KEY = 'fct-theme'

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark' // non-browser context — default theme
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage unavailable (e.g. private browsing); the choice still applies for this session
  }
}
