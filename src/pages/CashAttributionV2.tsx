// Cash attribution v2 — the controller's attribution spine, rebuilt natively on top of src/api.
// Same design as the reference prototype (public/cash-attribution.html): twelve causes grouped by originating
// function flow right into two cash pools; a lens rail recomputes over whatever survives both filters; an inspector
// traces the selected cause to its register row, interventions and cash opportunity. Every figure is data-driven
// and every record drills out (§8.4).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cutoffRiskThresholdDays, getCashOpportunities, getEntity, listCauseBacklog, listCauses } from '../api'
import type { CauseBacklogEntry, CauseNode } from '../api'
import { formatCr } from '../lib/format'
import { animation, colors, fonts, radius } from '../theme/tokens'
import { causeEliminationColor } from '../theme/derive'
import { MODE_PERIOD, useAppMode } from '../app/mode'

// The spine's scope. Cause values and cash opportunities are group-pinned to JGL in the dataset (the same rule as
// the O2C cockpit showing the shared taxonomy on every entity), so the screen is presented at group level with an
// explicit JGL scope — like touch economics presents "the mix is JGL's".
const SCOPE = 'JGL'

type PoolKey = 'ap' | 'ar'
type LensKey = 'all' | 'outside' | 'human' | 'noowner' | 'close'

// Sankey geometry — ported from the reference design (viewBox units).
const W = 1180
const TOP = 74
const BOT_PAD = 26
const NODE_X = 498
const NODE_W = 13
const STAT_X = NODE_X - 7
const STAT_W = 4
const POOL_X = 880
const POOL_W = 15
const GAP = 7
const GROUP_GAP = 15
const POOL_GAP = 54
const X0 = NODE_X + NODE_W
const X1 = POOL_X

// "Inside the owning team" per pool — which originating function holds the cash once it lands.
const INSIDE: Record<PoolKey, string[]> = { ap: ['AP & tax'], ar: ['Treasury'] }
const POOL_META: Record<PoolKey, { name: string; next: string }> = {
  ap: { name: 'Blocked AP', next: 'Understated accrual · R2R' },
  ar: { name: 'Revenue at risk', next: 'Working-capital drag' },
}

const CAUSES: CauseNode[] = [...listCauses('p2p'), ...listCauses('o2c')]
const poolOf = (c: CauseNode): PoolKey => (c.processKey === 'p2p' ? 'ap' : 'ar')
const fnOf = (c: CauseNode): string => c.originatingFunction ?? '—'
const sumV = (cs: CauseNode[]): number => cs.reduce((t, c) => t + c.valueAtRisk, 0)

// JGL's register rows drive the fix-status gutter and the inspector's remediation pane.
const REGISTER: Map<string, CauseBacklogEntry> = new Map(
  listCauseBacklog().filter((r) => r.entityCode === SCOPE).map((r) => [r.causeKey, r]),
)
type Reg = CauseBacklogEntry | { status: 'none' }
const NONE_REG: Reg = { status: 'none' }
function regOf(key: string): Reg { return REGISTER.get(key) ?? NONE_REG }

// §7.21 relative clock — target dates are stored as ISO from the start-of-day anchor; render them as "+N d".
function startOfTodayMs(): number { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() }
function targetText(row: Reg): string | null {
  if (row.status === 'none') return null
  if ('targetDate' in row && row.targetDate) return `+${Math.round((Date.parse(row.targetDate) - startOfTodayMs()) / 86400000)} d`
  if ('eliminatedInPeriod' in row && row.eliminatedInPeriod) return `met · period ${row.eliminatedInPeriod}`
  return null
}

const STATUS_LABEL: Record<Reg['status'], string> = { eliminated: 'Eliminated', 'in-progress': 'In progress', identified: 'Identified', none: 'Not on the register' }
function statusColor(status: Reg['status']): string {
  if (status === 'none') return colors.statusRed
  return causeEliminationColor(status)
}

// The value a human must still touch — P2P carries measured agent coverage; O2C is unmodelled and shows full value.
function humanValue(c: CauseNode): number {
  return c.agentResolvablePct == null ? c.valueAtRisk : c.valueAtRisk * (1 - c.agentResolvablePct / 100)
}

interface BandGeo { c: CauseNode; pool: PoolKey; y: number; h: number; landT: number; landB: number; ribbonD: string }
interface GroupMeta { o: string; y0: number }

function computeLayout(H: number) {
  const BOT = H - BOT_PAD
  const SPAN = BOT - TOP
  // The spine groups by originating function — the column header is "WHERE THE FAILURE HAPPENS".
  const groups = [...new Set(CAUSES.map(fnOf))]
    .map((o) => ({ o, cs: CAUSES.filter((c) => fnOf(c) === o).slice().sort((a, b) => b.valueAtRisk - a.valueAtRisk), v: sumV(CAUSES.filter((c) => fnOf(c) === o)) }))
    .sort((a, b) => b.v - a.v)

  const gapTotal = GAP * (CAUSES.length - 1) + GROUP_GAP * (groups.length - 1)
  const SCALE = (SPAN - gapTotal) / sumV(CAUSES)
  const hOf = (v: number): number => Math.max(11, v * SCALE)

  const poolH: Record<PoolKey, number> = { ap: hOf(sumV(CAUSES.filter((c) => poolOf(c) === 'ap'))), ar: hOf(sumV(CAUSES.filter((c) => poolOf(c) === 'ar'))) }
  const tot = poolH.ap + poolH.ar + POOL_GAP
  const poolsY: Record<PoolKey, number> = { ap: TOP + (SPAN - tot) / 2, ar: TOP + (SPAN - tot) / 2 + poolH.ap + POOL_GAP }

  let y = TOP
  const geoArr: BandGeo[] = []
  const groupMeta: GroupMeta[] = []
  groups.forEach((g, gi) => {
    groupMeta.push({ o: g.o, y0: y })
    g.cs.forEach((c, ci) => {
      const h = hOf(c.valueAtRisk)
      geoArr.push({ c, pool: poolOf(c), y, h, landT: 0, landB: 0, ribbonD: '' })
      y += h
      if (ci < g.cs.length - 1) y += GAP
    })
    if (gi < groups.length - 1) y += GROUP_GAP
  })

  // Ribbons land on the pools in band order; each keeps its source height.
  const cursor: Record<PoolKey, number> = { ap: poolsY.ap, ar: poolsY.ar }
  const m0 = X0 + (X1 - X0) * 0.5
  const m1 = X1 - (X1 - X0) * 0.5
  for (const g of geoArr) {
    const y0t = g.y, y0b = g.y + g.h
    const y1t = cursor[g.pool], y1b = y1t + g.h
    cursor[g.pool] = y1b
    g.landT = y1t; g.landB = y1b
    g.ribbonD = `M${X0},${y0t} C${m0},${y0t} ${m1},${y1t} ${X1},${y1t} L${X1},${y1b} C${m1},${y1b} ${m0},${y0b} ${X0},${y0b} Z`
  }
  return { geoArr, groupMeta, poolsY, poolH }
}

function passesLens(c: CauseNode, lens: LensKey): boolean {
  if (lens === 'outside') return !INSIDE[poolOf(c)].includes(fnOf(c))
  if (lens === 'human') return humanValue(c) > 0.35
  if (lens === 'noowner') return regOf(c.key).status === 'none'
  if (lens === 'close') return c.avgDelayDays >= cutoffRiskThresholdDays() // a proxy for cut-off risk, not a per-item deadline
  return true
}

// Deterministic starfield — seeded PRNG so the field is identical on every load and theme.
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / no-canvas environments — the field is decorative
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let raf = 0
    let stars: { x: number; y: number; z: number; vx: number; vy: number; ph: number }[] = []
    let wCss = 0, hCss = 0

    // The design's ink is its text colour; resolve the token so the field follows the theme.
    let inkRgb = '238,234,228'
    const refreshInk = () => {
      const v = (getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '').trim()
      if (/^#([0-9a-f]{6})$/i.test(v)) {
        const n = parseInt(v.slice(1), 16)
        inkRgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
      }
    }

    const seedField = () => {
      const parent = canvas.parentElement
      if (!parent || !parent.clientWidth) return
      wCss = parent.clientWidth
      hCss = parent.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(wCss * dpr)
      canvas.height = Math.round(hCss * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const rng = mulberry32(0x5eed)
      const n = Math.max(18, Math.round((wCss * hCss) / 26000))
      stars = Array.from({ length: n }, () => ({
        x: rng() * wCss, y: rng() * hCss, z: 0.4 + rng() * 0.6,
        vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, ph: rng() * 6.28,
      }))
    }

    const draw = (t: number) => {
      refreshInk()
      ctx.clearRect(0, 0, wCss, hCss)
      const L = 130
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i]
        if (!reduce) {
          a.x += a.vx; a.y += a.vy
          if (a.x < 0) a.x = wCss; else if (a.x > wCss) a.x = 0
          if (a.y < 0) a.y = hCss; else if (a.y > hCss) a.y = 0
        }
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 < L * L) {
            ctx.strokeStyle = `rgba(${inkRgb},${((1 - Math.sqrt(d2) / L) * 0.11 * Math.min(a.z, b.z)).toFixed(3)})`
            ctx.lineWidth = 0.55
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
      }
      for (const s of stars) {
        const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 0.001 + s.ph)
        ctx.fillStyle = `rgba(${inkRgb},${(0.22 * s.z * tw).toFixed(3)})`
        ctx.beginPath(); ctx.arc(s.x, s.y, (0.5 + s.z) * tw, 0, 6.283); ctx.fill()
      }
    }

    const loop = (t: number) => { draw(t); if (!reduce) raf = requestAnimationFrame(loop) }
    seedField()
    refreshInk()
    if (reduce) draw(0)
    else raf = requestAnimationFrame(loop)
    window.addEventListener('resize', () => { seedField(); if (reduce) draw(0) })
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', () => { seedField(); if (reduce) draw(0) }) }
  }, [])
  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55, pointerEvents: 'none' }} />
}

const mlStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, lineHeight: 1, letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.textMuted }

export function CashAttributionV2() {
  const { mode } = useAppMode()
  const entity = getEntity(SCOPE)! // SCOPE is pinned to the demo entity, which always exists in the dataset
  const apBlocked = entity.metrics.apBlocked.current
  const opportunities = getCashOpportunities()
  const reduce = useMemo(() => (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), [])

  const [selected, setSelected] = useState<string | null>('missing-gr') // the design's default selection — a lens choice clears it
  const [lens, setLens] = useState<LensKey>('all')
  const [proc, setProc] = useState<'all' | PoolKey>('all')
  const [hintGone, setHintGone] = useState(false)
  const [fxOn, setFxOn] = useState(false) // slice + caption reveal after the wipe

  useEffect(() => {
    if (!selected) return
    setFxOn(false)
    if (reduce) { setFxOn(true); return }
    const t = setTimeout(() => setFxOn(true), 420)
    return () => clearTimeout(t)
  }, [selected, reduce])

  // The directional wipe opens on every selection. SMIL begin="0s" does not run for remounted elements — the clip
  // rect stayed at width zero and clipped the selected ribbon to nothing — so the clip is driven with rAF instead.
  const wipeRef = useRef<SVGRectElement>(null)
  useEffect(() => {
    if (!selected || reduce) return
    const rect = wipeRef.current
    if (!rect) return
    let raf = 0
    const t0 = performance.now()
    const D = 550 // the reference design's .55 s wipe
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / D)
      rect.setAttribute('width', String((X1 - X0 + 2) * (1 - (1 - p) ** 3))) // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selected, reduce])

  const spineRef = useRef<HTMLDivElement>(null)
  const [boxH, setBoxH] = useState(640)
  useEffect(() => {
    const measure = () => {
      const el = spineRef.current
      if (!el || !el.clientWidth) return
      setBoxH(Math.max(560, Math.min(940, Math.round((W * el.clientHeight) / el.clientWidth))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const H = boxH
  const { geoArr, groupMeta, poolsY, poolH } = useMemo(() => computeLayout(H), [H])
  const byKey = useMemo(() => new Map(geoArr.map((g) => [g.c.key, g])), [geoArr])
  const sel = selected ? byKey.get(selected) ?? null : null

  // Process (P2P/O2C) and lens are independent axes combined with AND; the readout recomputes over whatever
  // survives both filters, so the headline never lies about scope.
  const subset = CAUSES.filter((c) => (proc === 'all' || poolOf(c) === proc) && passesLens(c, lens))

  let roBig: string, roNote: string
  if (subset.length === 0) {
    roBig = formatCr(0); roNote = 'No causes in this process match the lens.'
  } else if (lens === 'outside') {
    const out = subset.filter((c) => !INSIDE[poolOf(c)].includes(fnOf(c)))
    const pct = Math.round((sumV(out) / sumV(subset)) * 100)
    roBig = formatCr(sumV(out))
    roNote = `${pct}% of stuck cash is caused by a function that does not hold it. Chasing AP or collections harder cannot reach it.`
  } else if (lens === 'human') {
    const modelled = subset.filter((c) => c.agentResolvablePct != null)
    const residual = modelled.reduce((t, c) => t + humanValue(c), 0)
    const cleared = sumV(modelled) - residual
    const unmodelled = sumV(subset.filter((c) => c.agentResolvablePct == null))
    roBig = formatCr(residual + unmodelled)
    roNote = unmodelled > 0
      ? `Agents already clear ${formatCr(cleared)} of P2P. ${formatCr(residual)} of P2P still needs a person — the ${formatCr(unmodelled)} of O2C shows in full only because agent coverage there is not yet measured.`
      : `Agents already clear ${formatCr(cleared)}. ${formatCr(residual)} still needs a person.`
  } else if (lens === 'noowner') {
    const nf = subset.filter((c) => regOf(c.key).status === 'none')
    // The lens's own predicate is "not on the register", so the denominator must be the process-scoped set
    // before the lens — otherwise the fraction reads "4 of 4" and conveys no scope.
    const scoped = CAUSES.filter((c) => proc === 'all' || poolOf(c) === proc).length
    roBig = formatCr(sumV(nf))
    roNote = `${nf.length} of ${scoped} causes have no row on the elimination register — no owner, no target, no fix in flight.`
  } else if (lens === 'close') {
    const cl = subset.filter((c) => c.avgDelayDays >= cutoffRiskThresholdDays())
    roBig = formatCr(sumV(cl))
    roNote = `Causes whose average resolution already runs past ${cutoffRiskThresholdDays()} days. At day 4 of close that average no longer fits before cut-off — a proxy for cut-off risk, not a per-item deadline.`
  } else {
    roBig = formatCr(sumV(subset))
    roNote = `${subset.length} causes${proc === 'all' ? ', two pools' : ` · ${proc === 'ap' ? 'P2P only' : 'O2C only'}`}. Every band reconciles to the total — nothing is rounded into the headline.`
  }

  const humanRows = CAUSES.slice().sort((a, b) => humanValue(b) - humanValue(a)).slice(0, 5)

  // Inspector data for the selected cause.
  const selCause = sel?.c ?? null
  const selReg: Reg | null = selCause ? regOf(selCause.key) : null
  const selOpp = selCause ? opportunities.find((o) => o.causeKey === selCause.key) : undefined

  const poolColor = (p: PoolKey): string => (p === 'ap' ? colors.statusAmber : colors.ageingBarAlt)
  // No cool text token exists in the palette — ageingBarAlt is a non-text fill (3:1), so AR text falls back to a neutral tier.
  const poolText = (p: PoolKey): string => (p === 'ap' ? colors.statusAmber : colors.textSecondary)

  const selectCause = (key: string) => { setSelected(key); setHintGone(true) }
  // The lens drives the highlight: choosing one replaces any single-cause trace with its surviving set.
  const selectLens = (k: LensKey) => { setLens(k); setSelected(null) }

  const ribbonStyle = (g: BandGeo): CSSProperties => {
    if ((proc !== 'all' && g.pool !== proc) || !passesLens(g.c, lens)) return { opacity: 0.13 }
    if (selected === g.c.key) {
      return {
        fillOpacity: 0.5, stroke: poolColor(g.pool), strokeWidth: 1.2, strokeOpacity: 0.9,
        clipPath: reduce ? undefined : 'url(#fct-ca-wipe)',
        filter: `drop-shadow(0 0 7px color-mix(in srgb, ${colors.textPrimary} 30%, transparent))`,
      }
    }
    if (selected) return { fillOpacity: 0.055 }
    return { fillOpacity: 0.17 }
  }

  // Raise the selected ribbon above the rest so its outline reads over the others.
  const renderOrder = [...geoArr].sort((a, b) => (a.c.key === selected ? 1 : 0) - (b.c.key === selected ? 1 : 0))

  const segStyle = (k: 'all' | PoolKey): CSSProperties => ({
    flex: 1, padding: '7px 0', border: 0, cursor: 'pointer',
    fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase',
    background: k === proc ? (k === 'ar' ? colors.bgSelected : colors.bgAccentSoft) : 'transparent',
    color: k === proc ? (k === 'ar' ? colors.textPrimary : colors.accentText) : colors.textMuted,
  })

  const lensBtn = (k: LensKey): CSSProperties => ({
    display: 'block', width: '100%', padding: '9px 16px', border: 0, cursor: 'pointer', textAlign: 'left',
    borderLeft: `2px solid ${lens === k ? colors.accent : 'transparent'}`,
    // Opaque token — a semi-transparent fill under text would resolve to an uncomposited rgb in the contrast audit.
    background: lens === k ? colors.bgAccentSoft : 'transparent',
  })

  const paneStyle: CSSProperties = { padding: '11px 13px', border: `1px solid ${colors.borderSubtle}`, borderRadius: radius.sm, background: colors.bgRaised }

  return (
    <div
      id="fct-ca"
      style={{
        position: 'relative', height: '100%', minWidth: 1240, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '236px minmax(0, 1fr) 314px', gridTemplateRows: '64px minmax(0, 1fr) 204px',
        background: colors.bgRoot, color: colors.textPrimary,
      }}
    >
      <Starfield />

      {/* ---- header: scope · lede · reconciliation total · mode-aware clock ---- */}
      <header style={{ gridColumn: '1 / -1', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20, padding: '0 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', border: `1px solid ${colors.borderDefault}`, borderRadius: radius.pill, fontFamily: fonts.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textSecondary }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: radius.dot, background: colors.statusAmber }} />
          {entity.code} · {entity.name}
        </span>
        <p style={{ margin: 0, color: colors.textMuted, fontFamily: fonts.sans, fontSize: 11, lineHeight: 1.3, maxWidth: 280 }}>
          Where cash is stuck, which function causes it, and whether a fix is in flight.
        </p>
        <div id="fct-ca-recon" style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 18, borderLeft: `1px solid ${colors.borderSubtle}` }}>
          <b id="fct-ca-total" style={{ fontFamily: fonts.mono, fontSize: 21, fontWeight: 700, letterSpacing: '-0.04em' }}>{formatCr(sumV(CAUSES))}</b>
          <span style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 10 }}>
            stuck<br />{CAUSES.length} causes · ties to AP blocked {formatCr(apBlocked)}
          </span>
        </div>
        <span data-fct-ca-clock style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: radius.dot, background: colors.statusAmber, animation: animation.pulse }} />
          <b style={{ color: colors.accentText, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', fontWeight: 400 }}>{MODE_PERIOD[mode]}</b>
        </span>
      </header>

      {/* ---- left rail: process filter · lenses · readout · fix-status key ---- */}
      <nav style={{ position: 'relative', zIndex: 1, borderRight: `1px solid ${colors.borderSubtle}`, padding: '14px 0', overflowY: 'auto' }}>
        <span style={{ ...mlStyle, display: 'block', padding: '0 16px 9px' }}>Process</span>
        <div role="group" aria-label="Filter by process" style={{ display: 'flex', border: `1px solid ${colors.borderDefault}`, borderRadius: radius.sm, overflow: 'hidden' }}>
          {(['all', 'ap', 'ar'] as const).map((k) => (
            <button key={k} type="button" data-fct-ca-proc={k} onClick={() => setProc(k)} style={{ ...segStyle(k), borderRight: k === 'ar' ? 0 : `1px solid ${colors.borderDefault}` }}>
              {k === 'all' ? 'Both' : k === 'ap' ? 'P2P' : 'O2C'}
            </button>
          ))}
        </div>
        <hr style={{ margin: '12px 16px', border: 0, borderTop: `1px solid ${colors.borderSubtle}` }} />

        <span style={{ ...mlStyle, display: 'block', padding: '0 16px 9px' }}>Lens</span>
        {([
          ['all', 'All stuck cash', `${formatCr(sumV(CAUSES))} · ${CAUSES.length} causes`],
          ['outside', 'Caused outside the owning team', 'the structural lever'],
          ['human', 'Needs a human', 'after the agents clear'],
          ['noowner', 'No fix in flight', 'not on the register'],
          ['close', 'At risk of missing cut-off', `resolution already runs past ${cutoffRiskThresholdDays()} d`],
        ] as [LensKey, string, string][]).map(([k, strong, em]) => (
          <button key={k} type="button" data-fct-ca-lens={k} onClick={() => selectLens(k)} style={lensBtn(k)}>
            <strong style={{ display: 'block', fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: lens === k ? colors.textPrimary : undefined }}>{strong}</strong>
            <em style={{ display: 'block', marginTop: 3, fontStyle: 'normal', color: lens === k ? colors.textMuted : colors.textFaint, fontFamily: fonts.mono, fontSize: 10, lineHeight: 1.35 }}>{em}</em>
          </button>
        ))}
        <hr style={{ margin: '12px 16px', border: 0, borderTop: `1px solid ${colors.borderSubtle}` }} />

        <div id="fct-ca-readout" style={{ padding: '0 16px' }}>
          <span style={{ ...mlStyle, display: 'block', marginBottom: 8 }}>Reading</span>
          <div id="fct-ca-ro-big" style={{ fontFamily: fonts.mono, fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: colors.accentText }}>{roBig}</div>
          <p id="fct-ca-ro-note" style={{ margin: '6px 0 0', color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, lineHeight: 1.5 }}>{roNote}</p>
        </div>

        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <span style={{ ...mlStyle, display: 'block', marginBottom: 8 }}>Fix status</span>
          {([['eliminated', 'stops new cases'], ['in-progress', 'owner + target'], ['identified', 'no target set'], ['none', null]] as const).map(([s, suffix]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: colors.textSecondary, fontFamily: fonts.mono, fontSize: 9.5 }}>
              <i aria-hidden style={{ width: 4, height: 13, borderRadius: 1, flexShrink: 0, background: statusColor(s) }} />
              {STATUS_LABEL[s]}{suffix ? ` · ${suffix}` : ''}
            </div>
          ))}
        </div>
      </nav>

      {/* ---- centre: the Sankey spine ---- */}
      <section ref={spineRef} style={{ position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img"
          aria-label="Attribution of stuck cash from originating function to where the cash sits, with remediation status">
          {/* keyed by selection so the wipe restarts from a closed clip on every select */}
          <defs key={`wipe-${selected ?? 'none'}`}>
            <clipPath id="fct-ca-wipe">
              <rect ref={wipeRef} x={X0} y={0} height={H} width={reduce ? W : 0} />
            </clipPath>
          </defs>

          <text x={20} y={44} style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.16em', fill: colors.textMuted }}>WHERE THE FAILURE HAPPENS</text>
          <text x={NODE_X - 34} y={44} style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.16em', fill: colors.textMuted }}>CAUSE · FIX</text>
          <text x={POOL_X} y={44} style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.16em', fill: colors.textMuted }}>WHERE THE CASH SITS</text>

          {groupMeta.map((g) => (
            <g key={g.o}>
              <text x={20} y={g.y0 + 9} style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.13em', fill: colors.textMuted }}>{g.o.toUpperCase()}</text>
              <line x1={20} y1={g.y0 + 16} x2={NODE_X - 16} y2={g.y0 + 16} stroke={colors.borderSubtle} strokeWidth={1} />
            </g>
          ))}

          {/* ribbons — filled shapes, pool colour at low opacity */}
          <g>
            {renderOrder.map((g) => (
              <path key={g.c.key} d={g.ribbonD} fill={poolColor(g.pool)} style={{ ...ribbonStyle(g), transition: 'opacity .3s ease' }} />
            ))}
          </g>

          {/* pools — each drills to its process screen */}
          {(['ap', 'ar'] as PoolKey[]).map((p) => {
            const py = poolsY[p]
            const tx = POOL_X + POOL_W + 14
            const outsideV = sumV(CAUSES.filter((c) => poolOf(c) === p && !INSIDE[p].includes(fnOf(c))))
            const noFixV = sumV(CAUSES.filter((c) => poolOf(c) === p && regOf(c.key).status === 'none'))
            const op = (proc !== 'all' && proc !== p) ? 0.13 : sel && sel.pool !== p ? 0.3 : 1
            return (
              <a key={p} data-fct-ca-pool={p} href={p === 'ap' ? `/entity/${SCOPE}/p2p/invoices` : `/entity/${SCOPE}/o2c`} style={{ opacity: op, transition: 'opacity .3s ease', cursor: 'pointer' }}>
                <rect x={POOL_X} y={py} width={POOL_W} height={poolH[p]} rx={2} fill={poolColor(p)} fillOpacity={0.95} />
                <text x={tx} y={py + 22} style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', fill: poolText(p) }}>{formatCr(sumV(CAUSES.filter((c) => poolOf(c) === p)))}</text>
                <text x={tx} y={py + 42} style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 650, fill: colors.textPrimary }}>{POOL_META[p].name}</text>
                <text x={tx} y={py + 58} style={{ fontFamily: fonts.mono, fontSize: 9.5, fill: colors.textFaint }}>
                  {p === 'ap' ? 'liability that cannot clear' : `${CAUSES.filter((c) => poolOf(c) === 'ar').length} O2C causes`}
                </text>
                <line x1={tx} y1={py + 70} x2={tx + 150} y2={py + 70} stroke={colors.borderSubtle} strokeWidth={1} />
                <text x={tx} y={py + 86} style={{ fontFamily: fonts.mono, fontSize: 9.5, fill: colors.textMuted }}>↳ {POOL_META[p].next}</text>
                <text x={tx} y={py + 104} style={{ fontFamily: fonts.mono, fontSize: 9.5, fill: colors.statusRed }}>{Math.round((outsideV / sumV(CAUSES.filter((c) => poolOf(c) === p))) * 100)}% originates outside the team</text>
                {noFixV > 0 && (
                  <text x={tx} y={py + 120} style={{ fontFamily: fonts.mono, fontSize: 9.5, fill: colors.statusRed }}>{formatCr(noFixV)} has no fix in flight</text>
                )}
              </a>
            )
          })}

          {/* cause bands */}
          {geoArr.map((g) => {
            const c = g.c
            const reg = regOf(c.key)
            const isSel = selected === c.key
            const off = (proc !== 'all' && g.pool !== proc) || !passesLens(c, lens)
            const bh = g.h
            const ty = g.y + Math.min(bh / 2, 13)
            return (
              <g
                key={c.key}
                data-fct-ca-band={c.key}
                role="button"
                tabIndex={0}
                aria-label={`${c.name}, ${formatCr(c.valueAtRisk)} stuck, fix status ${STATUS_LABEL[reg.status]}`}
                onClick={() => selectCause(c.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCause(c.key) } }}
                style={{ opacity: off ? 0.13 : 1, pointerEvents: off ? 'none' : undefined, transition: 'opacity .3s ease', cursor: 'pointer' }}
              >
                <rect x={14} y={g.y - 3} width={POOL_X - 14} height={bh + 6} fill="transparent" />
                <rect className="fct-ca-rowbg" x={14} y={g.y - 3} width={NODE_X + NODE_W - 14} height={bh + 6} rx={3} fill={colors.textPrimary} />
                {/* selection marker — a caret at the row's left edge, independent of opacity */}
                <path d={`M14,${g.y + bh / 2 - 5} L20,${g.y + bh / 2} L14,${g.y + bh / 2 + 5} Z`} fill={colors.textPrimary} opacity={isSel ? 1 : 0} />
                {/* remediation gutter — status of the fix, alongside the size of the problem */}
                <rect className="fct-ca-stat" x={STAT_X} y={g.y} width={STAT_W} height={bh} rx={1} fill={statusColor(reg.status)} opacity={isSel || !selected ? (reg.status === 'none' ? 0.55 : 0.9) : 0.45} />
                <rect className="fct-ca-node" x={NODE_X} y={g.y} width={NODE_W} height={bh} rx={2} fill={poolColor(g.pool)} opacity={isSel || !selected ? 1 : 0.4} />
                {/* the name drills to the cause's root-cause screen; the rest of the row selects in place */}
                <a href={`/entity/${SCOPE}/root-cause/${c.processKey}/${c.key}`} style={{ cursor: 'pointer' }}>
                  <text className="fct-ca-cname" x={NODE_X - 16} y={ty + (bh < 26 ? 4 : 0)} textAnchor="end" pointerEvents="auto"
                    style={{ fontFamily: fonts.sans, fontSize: 11.5, fontWeight: isSel ? 700 : 600, fill: isSel ? colors.textPrimary : colors.textMuted }}>
                    {c.name}
                  </text>
                </a>
                {bh >= 26 ? (
                  <text x={NODE_X - 16} y={ty + 15} textAnchor="end" style={{ fontFamily: fonts.mono, fontSize: 10, fill: isSel ? colors.textPrimary : colors.textSecondary }}>{formatCr(c.valueAtRisk)}</text>
                ) : (
                  <text x={NODE_X + NODE_W + 9} y={ty + 4} style={{ fontFamily: fonts.mono, fontSize: 10, fill: isSel ? colors.textPrimary : colors.textSecondary }}>{formatCr(c.valueAtRisk)}</text>
                )}
                {bh >= 52 && (
                  <text x={NODE_X - 16} y={ty + 30} textAnchor="end" opacity={isSel || !selected ? 1 : 0.55} style={{ fontFamily: fonts.mono, fontSize: 9, fill: colors.textFaint }}>
                    {c.avgDelayDays} d delay · {c.recurrence}-month streak
                  </text>
                )}
              </g>
            )
          })}

          {/* selection fx — landing slice + caption, revealed after the wipe; only while the selection is inside the active filters */}
          {sel && (proc === 'all' || sel.pool === proc) && passesLens(sel.c, lens) && (
            <g key={`fx-${sel.c.key}`} style={{ opacity: fxOn ? 1 : 0, transition: 'opacity .3s ease' }}>
              <rect x={POOL_X - 3} y={sel.landT - 2} width={POOL_W + 6} height={sel.landB - sel.landT + 4} rx={2} fill="none" stroke={poolColor(sel.pool)} strokeWidth={1.6} />
              {(() => {
                const cap = `${formatCr(sel.c.valueAtRisk)} · ${Math.round((sel.c.valueAtRisk / sumV(CAUSES.filter((c) => poolOf(c) === sel.pool))) * 100)}% of ${POOL_META[sel.pool].name}`
                const cw = cap.length * 6.3 + 18
                const cxm = (X0 + X1) / 2
                const cy = ((sel.y + sel.h / 2) + (sel.landT + sel.landB) / 2) / 2
                return (
                  <>
                    <rect x={cxm - cw / 2} y={cy - 13} width={cw} height={24} rx={4} fill={colors.bgRaised} stroke={poolColor(sel.pool)} strokeWidth={1} />
                    <text id="fct-ca-caption" x={cxm} y={cy + 4} textAnchor="middle" style={{ fontFamily: fonts.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em', fill: colors.textPrimary }}>{cap}</text>
                  </>
                )
              })()}
            </g>
          )}

        </svg>

        {!hintGone && (
          <span style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', padding: '6px 14px', border: `1px solid ${colors.borderDefault}`, borderRadius: radius.pill, background: colors.bgRaised, fontFamily: fonts.mono, fontSize: 9.5, color: colors.textFaint }}>
            Select any cause to trace its cash — <b style={{ color: colors.accentText, fontWeight: 400 }}>the ribbon shows where it lands</b>
          </span>
        )}
      </section>

      {/* ---- right rail: needs a human today ---- */}
      <aside style={{ position: 'relative', zIndex: 1, borderLeft: `1px solid ${colors.borderSubtle}`, padding: '14px 0', overflowY: 'auto' }}>
        <span style={{ ...mlStyle, display: 'block', padding: '0 16px 10px' }}>Needs a human today</span>
        {humanRows.map((c) => {
          const reg = regOf(c.key)
          const tt = targetText(reg)
          const off = (proc !== 'all' && poolOf(c) !== proc) || !passesLens(c, lens)
          return (
            <button key={c.key} type="button" data-fct-ca-human={c.key} className="fct-ca-srow" onClick={() => selectCause(c.key)} style={{
              width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 10px', padding: '10px 16px',
              border: 0, borderTop: `1px solid ${colors.borderSubtle}`, cursor: 'pointer', textAlign: 'left', background: 'transparent', opacity: off ? 0.3 : 1, transition: 'opacity .3s ease',
            }}>
              <span style={{ fontFamily: fonts.sans, fontSize: 11.5, fontWeight: 600, color: colors.textPrimary }}>{c.name}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 11, fontWeight: 600, color: colors.statusAmber, textAlign: 'right' }}>{formatCr(humanValue(c))}</span>
              <span style={{ gridColumn: '1 / -1', color: reg.status === 'none' ? colors.statusRed : colors.textFaint, fontFamily: fonts.mono, fontSize: 9.5, lineHeight: 1.4 }}>
                {STATUS_LABEL[reg.status].toLowerCase()}{('owner' in reg && reg.owner) ? ` · ${reg.owner}` : ''}{tt ? ` · ${tt}` : ''}
              </span>
            </button>
          )
        })}
        <p style={{ margin: '12px 16px 0', color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9.5, lineHeight: 1.4 }}>
          Agent coverage is modelled for P2P causes only. O2C bands show full value until those rates are measured.
        </p>
      </aside>

      {/* ---- inspector: the selected cause traced end to end ---- */}
      <section id="fct-ca-inspector" style={{ gridColumn: '1 / -1', position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 244px 430px', gap: 22, padding: '14px 20px', borderTop: `1px solid ${colors.borderSubtle}`, overflowY: 'auto' }}>
        {selCause && sel && selReg ? (
          <>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ padding: '3px 8px', borderRadius: radius.sm, border: `1px solid ${poolColor(sel.pool)}`, background: colors.bgRaised, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.09em', color: poolText(sel.pool) }}>
                  {fnOf(selCause).toUpperCase()}
                </span>
                <span style={mlStyle}>{(sel.pool === 'ap' ? 'P2P · ' : 'O2C · ') + selCause.key.toUpperCase()}</span>
              </div>
              <Link to={`/entity/${SCOPE}/root-cause/${selCause.processKey}/${selCause.key}`} style={{ display: 'block', margin: '8px 0 6px', fontFamily: fonts.sans, fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em', color: colors.accentText, textDecoration: 'none' }}>
                {selCause.name}
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {[fnOf(selCause), selCause.name, `${POOL_META[sel.pool].name} ${formatCr(selCause.valueAtRisk)}`, POOL_META[sel.pool].next].map((t, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <i aria-hidden style={{ color: colors.textFaint, fontStyle: 'normal' }}>→</i>}
                    <b style={{ padding: '3px 7px', border: `1px solid ${i === 2 ? poolColor(sel.pool) : colors.borderDefault}`, borderRadius: radius.sm, background: colors.bgRaised, color: i === 2 ? poolText(sel.pool) : colors.textPrimary, fontFamily: fonts.mono, fontSize: 9.5, fontWeight: 400 }}>{t}</b>
                  </span>
                ))}
                <span style={{ color: colors.textSecondary, fontFamily: fonts.mono, fontSize: 9.5 }}>
                  {selCause.plants.slice(0, 2).map((p) => `${p.name} ${p.pct}%`).join(' · ')} · {selCause.vendors[0].name} {selCause.vendors[0].pct}% · {selCause.concentration}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  ['VALUE STUCK', formatCr(selCause.valueAtRisk), poolText(sel.pool)],
                  ['AVG DELAY', `${selCause.avgDelayDays} d`, colors.textPrimary],
                  ['RECURRING', `${selCause.recurrence}${selCause.recurrence === 1 ? ' month' : ' months'}`, colors.textPrimary],
                  ['AGENTS CLEAR', selCause.agentResolvablePct == null ? 'not modelled' : `${selCause.agentResolvablePct}%`, selCause.agentResolvablePct == null ? colors.textFaint : colors.statusGreen],
                ].map(([label, value, col]) => (
                  <div key={label as string} style={{ paddingTop: 7, borderTop: `1px solid ${colors.borderDefault}` }}>
                    <small style={{ display: 'block', color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.07em' }}>{label}</small>
                    <b style={{ display: 'block', marginTop: 4, fontFamily: fonts.mono, fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', color: col as string }}>{value}</b>
                  </div>
                ))}
              </div>
            </div>

            {/* remediation — the register row for this cause */}
            <section style={paneStyle}>
              <span style={{ ...mlStyle, display: 'block', marginBottom: 9 }}>Remediation</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <i aria-hidden style={{ width: 8, height: 8, borderRadius: radius.dot, flexShrink: 0, background: statusColor(selReg.status) }} />
                <b style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 650, color: statusColor(selReg.status) }}>{STATUS_LABEL[selReg.status]}</b>
              </span>
              {selReg.status === 'none' ? (
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
                  <dt style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.06em' }}>OWNER</dt>
                  <dd style={{ margin: 0, color: colors.textSecondary, fontFamily: fonts.mono, fontSize: 10 }}>— none assigned</dd>
                  <dt style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.06em' }}>TARGET</dt>
                  <dd style={{ margin: 0, color: colors.textSecondary, fontFamily: fonts.mono, fontSize: 10 }}>— none set</dd>
                </dl>
              ) : (
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
                  <dt style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.06em' }}>REGISTER</dt>
                  <dd style={{ margin: 0 }}>{'id' in selReg ? (
                    <Link to="/cause-backlog" data-fct-ca-register-link style={{ color: colors.accentText, fontFamily: fonts.mono, fontSize: 10, textDecoration: 'none' }}>{selReg.id}</Link>
                  ) : null}</dd>
                  <dt style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.06em' }}>OWNER</dt>
                  <dd style={{ margin: 0, color: colors.textSecondary, fontFamily: fonts.mono, fontSize: 10 }}>{('owner' in selReg && selReg.owner) || '—'}</dd>
                  <dt style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9, letterSpacing: '0.06em' }}>TARGET</dt>
                  <dd style={{ margin: 0, color: targetText(selReg) ? colors.textSecondary : colors.textFaint, fontFamily: fonts.mono, fontSize: 10 }}>{targetText(selReg) ?? '— none set'}</dd>
                </dl>
              )}
              <p style={{ margin: '9px 0 0', color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9.5, lineHeight: 1.45 }}>
                {selReg.status === 'eliminated' && `Eliminated stops the cause generating new exceptions. The ${formatCr(selCause.valueAtRisk)} above is the existing stock still draining.`}
                {selReg.status === 'identified' && 'Identified but not started — the register carries no target date rather than an invented commitment.'}
                {selReg.status === 'in-progress' && 'Fix in flight. Recheck the value against the target date to see whether it is working.'}
                {selReg.status === 'none' && 'No row on the register, so nobody owns eliminating this and no date exists to review it against.'}
              </p>
            </section>

            {/* interventions + cash opportunity */}
            <section style={paneStyle}>
              <span style={{ ...mlStyle, display: 'block', marginBottom: 9 }}>{selReg.status === 'eliminated' ? 'Interventions · applied' : 'Interventions · from the taxonomy'}</span>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {selCause.actions.map((a, i) => (
                  <li key={i} style={{ position: 'relative', paddingBottom: 7, paddingLeft: 24, color: selReg.status === 'eliminated' ? colors.textFaint : colors.textSecondary, fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 1.4, textDecoration: selReg.status === 'eliminated' ? 'line-through' : undefined, textDecorationColor: colors.borderDefault }}>
                    <i aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, border: `1px solid ${selReg.status === 'eliminated' ? `color-mix(in srgb, ${colors.statusGreen} 50%, transparent)` : colors.borderDefault}`, color: selReg.status === 'eliminated' ? colors.statusGreen : colors.textMuted, fontFamily: fonts.mono, fontSize: 9, fontStyle: 'normal' }}>
                      {selReg.status === 'eliminated' ? '✓' : i + 1}
                    </i>
                    {a}
                  </li>
                ))}
              </ol>
              <div style={{ marginTop: 8, paddingTop: 9, borderTop: `1px solid ${colors.borderSubtle}` }}>
                {selOpp ? (
                  <Link to={`/entity/${SCOPE}/working-capital`} data-fct-ca-opp-link className="fct-ca-opp" style={{ display: 'flex', flexDirection: 'column', gap: 3, textDecoration: 'none' }}>
                    <b style={{ color: colors.statusGreen, fontFamily: fonts.mono, fontSize: 11, fontWeight: 650 }}>{formatCr(selOpp.value)}</b>
                    <span style={{ color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 11 }}>{selOpp.name}</span>
                    <em style={{ fontStyle: 'normal', color: colors.textFaint, fontFamily: fonts.mono, fontSize: 9.5 }}>{selOpp.items} items · {selOpp.effort} effort · {selOpp.owner}</em>
                  </Link>
                ) : (
                  <span style={{ color: colors.textFaint, fontFamily: fonts.mono, fontSize: 10 }}>No cash opportunity listed against this cause.</span>
                )}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </div>
  )
}
