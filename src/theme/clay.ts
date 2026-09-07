import type { CSSProperties } from 'react'
import { colors, fonts, radius, shadows, spacing } from './tokens'

// Clay surface recipes shared by every page. Elevation is spent by role:
//   card   — raised: a thing you can read as one object (KPI tile, panel, lower card)
//   frame  — raised: the single container around a table; rows inside are flat + hairline
//   sunken — inset: tracks, wells, expanded detail, selected states
// Nothing else casts a shadow. Borders are hairlines only, never the primary edge.
export const card: CSSProperties = {
  background: colors.bgPanel,
  borderRadius: radius.xl,
  boxShadow: shadows.up,
  padding: spacing.cardPadding,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

export const cardAccent: CSSProperties = { ...card, background: colors.bgAccentPanel }

export const cardRisk: CSSProperties = { ...card, background: colors.bgRiskSoft }

// A table's frame — the rows inside use hairlines, so the frame keeps its own padding tight.
export const frame: CSSProperties = {
  background: colors.bgPanel,
  borderRadius: radius.xl,
  boxShadow: shadows.up,
  padding: '6px 8px 4px',
  display: 'flex',
  flexDirection: 'column',
}

// Header strip inside a frame (eyebrow + right-hand note).
export const frameHead: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 18px 10px',
  borderBottom: `1px solid ${colors.borderSubtle}`,
}

export const sunken: CSSProperties = {
  background: colors.bgSelected,
  borderRadius: radius.md,
  boxShadow: shadows.in,
}

export const kpiTile: CSSProperties = {
  background: colors.bgPanel,
  borderRadius: radius.lg,
  boxShadow: shadows.up,
  padding: '16px 22px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 150,
}

// Mono status/label tag as an inset pill; colour carries the state, the text carries the meaning.
export function tag(color: string, soft?: string): CSSProperties {
  return {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    padding: '4px 9px',
    borderRadius: radius.pill,
    boxShadow: shadows.in,
    background: soft ?? colors.bgPanel,
    color,
    whiteSpace: 'nowrap',
    display: 'inline-block',
  }
}

// Raised pill button; pair with the .fct-press class for the pressed (inset) state.
export const pillButton: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 13,
  fontWeight: 600,
  padding: '9px 16px',
  borderRadius: radius.pill,
  border: 'none',
  background: colors.bgPanel,
  color: colors.textPrimary,
  boxShadow: shadows.upSm,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

export const pillButtonAccent: CSSProperties = { ...pillButton, background: colors.accent, color: '#FFFFFF' }

// Small mono control pill (mode switcher, access toggle, reset).
export function controlPill(active: boolean): CSSProperties {
  return {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    padding: '5px 10px',
    borderRadius: radius.pill,
    border: 'none',
    background: active ? colors.accent : colors.bgPanel,
    color: active ? '#FFFFFF' : colors.textMuted,
    boxShadow: active ? shadows.upSm : shadows.in,
    cursor: 'pointer',
  }
}

export const pageStyle: CSSProperties = { padding: spacing.contentPadding, display: 'flex', flexDirection: 'column', gap: 24 }

export const monoNote: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }
