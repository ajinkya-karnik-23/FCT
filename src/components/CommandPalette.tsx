import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { agentWorkforceSummary, causeBacklogCounts, commitmentsWatch, computeScore, getControlSignals, getEntity, getForecast, listAgents, listCauses, listCompliance, listCostCentres, listCounterparties, listDataQuality, listEntities, listExceptions, listPlants, listRequests, listTouchFunnel, slaBreachSplit } from '../api'
import { formatCr } from '../lib/format'
import { colors, fonts, layout, paletteShadow, radius } from '../theme/tokens'
import { DEFAULT_ENTITY, entityCodeFromPath } from '../app/routes'

interface PaletteItem {
  kind: string
  label: string
  meta: string
  to: string
}

// Result set in spec order — entities, exceptions, root causes, counterparties (scoped to the entity in context), screens.
function buildItems(entityCode: string): PaletteItem[] {
  const items: PaletteItem[] = []
  for (const e of listEntities()) {
    items.push({ kind: 'ENTITY', label: e.name, meta: `health ${computeScore(e).displayed}`, to: `/entity/${e.code}` })
  }
  for (const x of listExceptions()) {
    items.push({ kind: 'EXCEPTION', label: `${x.id} · ${x.vendor}`, meta: `${formatCr(x.amount, 2)} · ${x.ageDays} d`, to: `/entity/${x.entityCode}/p2p/invoices/${x.id}` })
  }
  for (const processKey of ['p2p', 'o2c'] as const) {
    for (const c of listCauses(processKey)) {
      items.push({ kind: 'ROOT CAUSE', label: `${c.name} · ${processKey.toUpperCase()}`, meta: formatCr(c.valueAtRisk), to: `/entity/${entityCode}/root-cause/${processKey}/${c.key}` })
    }
  }
  // §7.24 — counterparties are first-class objects; scoped to the entity in context so a drill target is always one row away.
  for (const c of listCounterparties(entityCode)) {
    const kind = c.type === 'vendor' ? 'VENDOR' : 'CUSTOMER'
    const meta = c.type === 'vendor' ? formatCr(c.blockedCr) : `exposure ${formatCr(c.exposureCr ?? 0)}`
    items.push({ kind, label: c.name, meta, to: `/entity/${c.entityCode}/${c.type}/${c.id}` })
  }
  for (const p of listPlants(entityCode)) {
    items.push({ kind: 'PLANT', label: p.name, meta: formatCr(p.blockedCr), to: `/entity/${p.entityCode}/plant/${p.id}` })
  }
  for (const cc of listCostCentres(entityCode)) {
    items.push({ kind: 'COST CENTRE', label: cc.name, meta: `committed ${formatCr(cc.committedSpendCr)}`, to: `/entity/${cc.entityCode}/cost-centre/${cc.id}` })
  }
  // §7.31 — the worklist and working-capital rows follow the entity in context; unknown codes fall back rather than borrow JGL's figures.
  const ctx = getEntity(entityCode)
  items.push({ kind: 'SCREEN', label: 'Group view', meta: '6 entities', to: '/' })
  items.push({ kind: 'SCREEN', label: 'P2P cockpit', meta: 'process', to: `/entity/${entityCode}/p2p` })
  items.push({ kind: 'SCREEN', label: 'O2C cockpit', meta: 'process', to: `/entity/${entityCode}/o2c` })
  items.push({ kind: 'SCREEN', label: 'Blocked invoices worklist', meta: ctx ? `${ctx.metrics.apBlockedCount} items` : '—', to: `/entity/${entityCode}/p2p/invoices` })
  // §15.7 — the commitments watch follows the entity in context; its row states the pool and what is at risk of slipping past period-end.
  const cw = ctx ? commitmentsWatch(entityCode) : undefined
  items.push({ kind: 'SCREEN', label: 'Commitments watch', meta: cw ? `${cw.openPosCount} open POs · ${formatCr(cw.valueAtRiskCr)} at risk` : '—', to: `/entity/${entityCode}/p2p/commitments` })
  items.push({ kind: 'SCREEN', label: 'Working capital', meta: ctx ? `${formatCr(ctx.metrics.releasableCash)} releasable` : '—', to: `/entity/${entityCode}/working-capital` })
  items.push({ kind: 'SCREEN', label: 'Risk & control', meta: `${getControlSignals().length} open signals`, to: '/risk-control' })
  // §7.26/§7.27 — the ASSURE screens; counts come from the dataset, never literals.
  items.push({ kind: 'SCREEN', label: 'Compliance', meta: `${listCompliance().filter((c) => c.status !== 'filed').length} open obligations`, to: '/compliance' })
  items.push({ kind: 'SCREEN', label: 'Data quality', meta: `${listDataQuality().reduce((s, d) => s + d.failCount, 0)} failing records`, to: '/data-quality' })
  items.push({ kind: 'SCREEN', label: 'Service & attribution', meta: `${slaBreachSplit().total} SLA breaches`, to: `/entity/${entityCode}/service` })
  // §7.29 — the desk is group-scoped; its count comes from the request dataset, never a literal. §9.1 — full name in the rail and palette.
  items.push({ kind: 'SCREEN', label: 'Finance Service Desk', meta: `${listRequests().filter((r) => r.status !== 'closed').length} open requests`, to: '/service-desk' })
  // §7.30 — the elimination backlog is group-scoped like the desk; counts derive from the register, never literals.
  const cb = causeBacklogCounts()
  items.push({ kind: 'SCREEN', label: 'Cause elimination', meta: `${cb.eliminated} of ${cb.identified} causes eliminated`, to: '/cause-backlog' })
  // §15 — the agent workforce is group-scoped; the row states live vs total so the palette never claims what isn't built.
  const wf = agentWorkforceSummary()
  items.push({ kind: 'SCREEN', label: 'Agents', meta: `${wf.liveRoles} of ${wf.totalRoles} roles active`, to: '/agents' })
  // §15.7 — each agent's record is reachable from the palette, like counterparties (§9.1); query-filtered and capped as all rows are.
  for (const a of listAgents()) {
    items.push({ kind: 'AGENT', label: a.name, meta: `#${a.number} · ${a.type}`, to: `/agents/${a.id}` })
  }
  // §15.3/§15.4 — the commercial conversation is group-scoped; the row states JGL's touch rate, the screen's headline figure.
  const te = listTouchFunnel().find((r) => r.code === 'JGL')!
  items.push({ kind: 'SCREEN', label: 'Touch economics', meta: `JGL ${te.touchesTodayPer1000} → ${te.touchesAfterPer1000} / 1,000`, to: '/touch-economics' })
  // §7.23 — every entity carries its own forecast; the row follows the entity in context, as the other screens do.
  const fc = getForecast(entityCode)
  if (fc) items.push({ kind: 'SCREEN', label: 'Predictive', meta: `DSO ${fc.current} → ${fc.projected} at month-end`, to: `/entity/${entityCode}/predictive` }) // unknown codes render the fallback page, which has no forecast
  return items
}

const MAX_ROWS = 9

interface CommandPaletteProps {
  open: boolean
  onOpen(): void // fired by the global ⌘K / Ctrl+K shortcut
  onClose(): void // Escape, scrim click, or after picking a result
}

export function CommandPalette({ open, onOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const entityCode = entityCodeFromPath(pathname) ?? DEFAULT_ENTITY

  // Global shortcut: ⌘K (Mac) / Ctrl+K (Windows/Linux). Bound at window level, removed on unmount.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      } else if (open && e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpen, onClose])

  // Fresh query each time the palette opens.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const items = useMemo(() => buildItems(entityCode), [entityCode])
  const q = query.trim().toLowerCase()
  const shown = (q ? items.filter((i) => `${i.label} ${i.kind}`.toLowerCase().includes(q)) : items).slice(0, MAX_ROWS)

  function pick(item: PaletteItem) {
    navigate(item.to)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fct-palette-scrim"
      style={{ position: 'fixed', inset: 0, background: layout.paletteScrim, zIndex: 50, paddingTop: layout.paletteTopOffset, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{ width: layout.paletteWidth, maxWidth: '100%', background: colors.bgPanel, borderRadius: radius.xl, boxShadow: paletteShadow, padding: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fct-well" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>{'>'}</span>
          <input
            className="fct-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown.length > 0) pick(shown[0])
            }}
            placeholder="Jump to an entity, process, exception or vendor"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.textPrimary }}
          />
          <span aria-hidden style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0 2px' }}>
          {shown.map((item) => (
            <button key={`${item.kind}-${item.label}`} type="button" className="fct-palette-row" onClick={() => pick(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
              <span style={{ width: 84, flexShrink: 0, fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.12em', color: colors.textFaint }}>{item.kind}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: colors.textPrimary }}>{item.label}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
