import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listCauses, listEntities, listExceptions } from '../api'
import { formatCr } from '../lib/format'
import { colors, fonts, layout, paletteShadow } from '../theme/tokens'
import { DEFAULT_ENTITY, entityCodeFromPath } from '../app/routes'

interface PaletteItem {
  kind: string
  label: string
  meta: string
  to: string
}

// Result set in spec order — entities, exceptions, root causes, screens.
function buildItems(entityCode: string): PaletteItem[] {
  const items: PaletteItem[] = []
  for (const e of listEntities()) {
    items.push({ kind: 'ENTITY', label: e.name, meta: `health ${e.score}`, to: `/entity/${e.code}` })
  }
  for (const x of listExceptions()) {
    items.push({ kind: 'EXCEPTION', label: `${x.id} · ${x.vendor}`, meta: `${formatCr(x.amount, 2)} · ${x.ageDays} d`, to: `/entity/${x.entityCode}/p2p/invoices/${x.id}` })
  }
  for (const c of listCauses('p2p')) {
    items.push({ kind: 'ROOT CAUSE', label: c.name, meta: formatCr(c.valueAtRisk), to: `/entity/${entityCode}/root-cause/${c.key}` })
  }
  items.push({ kind: 'SCREEN', label: 'Group view', meta: '6 entities', to: '/' })
  items.push({ kind: 'SCREEN', label: 'P2P cockpit', meta: 'process', to: `/entity/${entityCode}/p2p` })
  items.push({ kind: 'SCREEN', label: 'Blocked invoices worklist', meta: '327 items', to: `/entity/${entityCode}/p2p/invoices` })
  items.push({ kind: 'SCREEN', label: 'Working capital', meta: '₹4.2 cr releasable', to: `/entity/${entityCode}/working-capital` })
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
        style={{ width: layout.paletteWidth, maxWidth: '100%', background: colors.bgPanel, border: `1px solid ${colors.borderStrong}`, boxShadow: paletteShadow }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${colors.borderDefault}`, display: 'flex', alignItems: 'center', gap: 12 }}>
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
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', fontSize: 15, color: colors.textPrimary }}
          />
          <span aria-hidden style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {shown.map((item) => (
            <button key={`${item.kind}-${item.label}`} type="button" className="fct-palette-row" onClick={() => pick(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px' }}>
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
