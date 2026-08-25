import type { CSSProperties } from 'react'

export const colors = {
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
  assistantBorder: '#1B2634', // assistant bubbles + preset buttons (spec/07)
} as const

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
  paletteScrim: 'rgba(4, 7, 11, 0.72)',
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

// The only shadow in the product; reserved for the command palette.
export const paletteShadow = '0 40px 100px -30px rgba(0, 0, 0, 0.9)'

function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export const cssVariables: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [`--${toKebab(name)}`, value]),
  ),
  '--font-sans': fonts.sans,
  '--font-mono': fonts.mono,
}

export function applyTheme(): void {
  const style = document.documentElement.style
  for (const [name, value] of Object.entries(cssVariables)) {
    style.setProperty(name, value)
  }
}
