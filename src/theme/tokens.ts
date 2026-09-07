import type { CSSProperties } from 'react'

// Clay · graphite + amber. The two palettes are the only place hex/rgba values live in
// the product. Both were derived by one method (see DESIGN-CLAY.md): a single warm hue
// (70°) held fixed in OKLCH, neutrals tinted ~0.5% toward it, an ink lightness ladder,
// ONE accent (amber — which is also the warning status, "amber means attention"), a
// cool data hue (250°) so bars never read as buttons, and a lightness-staggered status
// trio. Every text tier was fitted by script to the contrast rules in tokens.test.ts.
export const dark = {
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

export type Palette = Record<keyof typeof dark, string>

export const light: Palette = {
  bgRoot: '#F2F0ED',
  bgPanel: '#F5F3F1',
  bgPanelAlt: '#EFECE9',
  bgRaised: '#FBFAF8',
  bgSelected: '#E8E6E3',
  bgAccentSoft: '#F4E6CE',
  bgAccentPanel: '#F6EDE0',
  borderDefault: '#DAD7D4',
  borderSubtle: '#E3E1DE',
  borderStrong: '#C0BDBA',
  borderAccent: '#CCA86A',
  textPrimary: '#2C2824',
  textSecondary: '#4B4742',
  textMuted: '#67625D',
  textFaint: '#736E69',
  textFaintest: '#A39D98',
  accent: '#B27A00',
  accentText: '#8E5C00',
  statusGreen: '#00763A',
  statusAmber: '#8C6200',
  statusRed: '#A90021',
  chartArOld: '#B4551E',
  ageingBarAlt: '#6B89A9',
  bgAccentHover: '#F0DBB9',
  bgWarnSoft: '#F6EFE1',
  bgRiskSoft: '#FAECEC',
  assistantBorder: '#DAD7D4',
  paletteScrim: 'rgba(44, 40, 36, 0.55)',
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
  sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'IBM Plex Mono', Menlo, monospace",
} as const

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

// Spec gives ranges for some scales; the canonical value is used unless a view overrides it.
export const typeScale = {
  viewTitle: { fontSize: '27px', fontWeight: fontWeights.bold, letterSpacing: '-0.01em', lineHeight: 1.15, fontFamily: fonts.sans },
  bigScore: { fontSize: '44px', fontWeight: fontWeights.bold, lineHeight: 1, fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums' },
  kpiValue: { fontSize: '26px', fontWeight: fontWeights.bold, fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums' },
  tileValue: { fontSize: '22px', fontWeight: fontWeights.bold, fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums' },
  stageVolume: { fontSize: '19px', fontWeight: fontWeights.regular, fontFamily: fonts.mono, fontVariantNumeric: 'tabular-nums' },
  body: { fontSize: '13px', fontWeight: fontWeights.regular, fontFamily: fonts.sans },
  uiBase: { fontSize: '14px', fontWeight: fontWeights.regular, fontFamily: fonts.sans },
  eyebrow: {
    fontSize: '11px',
    fontWeight: fontWeights.regular,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: colors.accentText,
    fontFamily: fonts.mono,
  },
  tableHeader: {
    fontSize: '10px',
    fontWeight: fontWeights.regular,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: colors.textFaint,
    fontFamily: fonts.mono,
  },
} satisfies Record<string, CSSProperties>

export type TypeScaleName = keyof typeof typeScale

export const spacing = {
  contentPadding: '32px 32px 64px',
  cardPadding: '22px',
  tableCellPadding: '12px 18px',
  gapCards: '18px',
  gapStages: '12px',
  gapCardInner: '12px',
} as const

export const layout = {
  railWidth: '236px',
  topBarHeight: '64px',
  aiDrawerWidth: '470px',
  paletteWidth: '720px',
  paletteTopOffset: '12vh',
  paletteScrim: 'var(--palette-scrim)',
} as const

// Clay radii: generous on containers, tighter on inner controls, pill for tabs/chips/buttons.
export const radius = {
  none: 0,
  sm: '8px', // inner chips, kbd, meters, expand chips
  md: '14px', // rows, inputs, inline callouts, sunken panels
  lg: '20px', // KPI tiles
  xl: '22px', // cards, table frames, drawers
  pill: '999px', // tabs, buttons, tags
  dot: '50%', // status dots
} as const

// Clay elevation — set per theme by applyTheme (the arms invert on dark ground).
// `up` = pressable/raised (tiles, frames, cards, buttons); `in` = sunken (tracks, active tab well,
// selected rows, expanded panels). Rows inside a frame are flat: elevation is spent by role.
export const shadows = {
  up: 'var(--shadow-up)',
  upSm: 'var(--shadow-up-sm)',
  in: 'var(--shadow-in)',
} as const

const CLAY_SHADOWS: Record<Theme, Record<'--shadow-up' | '--shadow-up-sm' | '--shadow-in', string>> = {
  light: {
    '--shadow-up': '-6px -6px 14px rgba(255, 255, 255, 0.95), 6px 6px 16px rgba(44, 40, 36, 0.16)',
    '--shadow-up-sm': '-3px -3px 8px rgba(255, 255, 255, 0.9), 4px 4px 10px rgba(44, 40, 36, 0.14)',
    '--shadow-in': 'inset -3px -3px 8px rgba(255, 255, 255, 0.9), inset 4px 4px 10px rgba(44, 40, 36, 0.18)',
  },
  dark: {
    '--shadow-up': '-4px -4px 10px rgba(255, 255, 255, 0.035), 6px 6px 16px rgba(0, 0, 0, 0.6)',
    '--shadow-up-sm': '-2px -2px 6px rgba(255, 255, 255, 0.03), 4px 4px 10px rgba(0, 0, 0, 0.55)',
    '--shadow-in': 'inset -3px -3px 8px rgba(255, 255, 255, 0.04), inset 4px 4px 10px rgba(0, 0, 0, 0.65)',
  },
}

export const barHeights = {
  stageRate: 4,
  inlineMeter: 8,
  ageing: 18,
  dimensionColumn: 22,
} as const

export const animation = {
  pulse: 'pulse 2.4s ease-in-out infinite',
  fadeIn: 'fade-in 140ms ease-out',
} as const

// Command-palette drop shadow. Same value in both themes.
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
  ...CLAY_SHADOWS[theme],
  '--font-sans': fonts.sans,
  '--font-mono': fonts.mono,
})

export function applyTheme(theme: Theme = 'dark'): void {
  const style = document.documentElement.style
  for (const [name, value] of Object.entries(themeVariables(theme))) {
    style.setProperty(name, value)
  }
  // Lets index.css branch on theme for the few rules that cannot be expressed as a var (e.g. color-scheme).
  document.documentElement.dataset.theme = theme
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
