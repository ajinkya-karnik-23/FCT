import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { colors, fonts, radius, spacing, typeScale } from '../theme/tokens'
import { sunken } from '../theme/clay'

export interface Column<T> {
  header: ReactNode
  width?: string
  align?: 'left' | 'right' | 'center'
  render: (row: T) => ReactNode
  // Scan-table IA: a detail column is not shown in the row — it lives in the row's expansion,
  // one click away, so the row stays scannable (one glance, one chart at most).
  detail?: boolean
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  style?: CSSProperties
}

const cellStyle: CSSProperties = { padding: spacing.tableCellPadding, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// A primary column whose content the row clipped — its header plus the full (untruncated) text, so the
// expansion can give it back. Truncation is measured in the browser (scrollWidth vs clientWidth); jsdom has no
// layout, so this stays inert under unit tests and only fires where a cell genuinely overflows.
interface TruncatedCell {
  col: number
  header: ReactNode
  text: string
}

type RowKey = string | number

// One grid cell that knows whether its content is clipped. It reports the full text up to the table so the row's
// expansion can surface it, and carries a native title as the floor (hover reveals what the ellipsis hid).
function Cell<T>({ column, row, colIndex, onMeasure }: { column: Column<T>; row: T; colIndex: number; onMeasure: (col: number, info: TruncatedCell | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState<TruncatedCell | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const clipped = el.scrollWidth > el.clientWidth + 1
      setInfo(clipped ? { col: colIndex, header: column.header, text: (el.textContent ?? '').trim() } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [row]) // re-measure when the row's content changes

  const reported = useRef(false)
  useLayoutEffect(() => {
    if (info === null && !reported.current) return // never clipped — no need to announce its absence on mount
    reported.current = info !== null
    onMeasure(colIndex, info)
  }, [info]) // report up only when the clipped state flips

  return (
    <div ref={ref} title={info ? info.text : undefined} style={{ ...cellStyle, textAlign: column.align ?? 'left' }}>
      {column.render(row)}
    </div>
  )
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, style }: DataTableProps<T>) {
  const primary = columns.filter((c) => !c.detail)
  const detail = columns.filter((c) => c.detail)
  const [open, setOpen] = useState<RowKey | null>(null)
  // Per row: which primary cells are clipped (col index → full text). Drives the expander and the expansion.
  const [clippedByRow, setClippedByRow] = useState<Partial<Record<RowKey, TruncatedCell[]>>>({})

  const handleMeasure = useCallback((key: RowKey, col: number, info: TruncatedCell | null) => {
    setClippedByRow((prev) => {
      const list = prev[key] ? [...prev[key]] : []
      const at = list.findIndex((t) => t.col === col)
      if (info && at === -1) list.push(info)
      else if (!info && at !== -1) list.splice(at, 1)
      else if (info && at !== -1) list[at] = info
      return { ...prev, [key]: list }
    })
  }, [])

  // The expander column is reserved only when a row has something to reveal — a detail column, or a cell the ellipsis
  // clipped. Tables with neither render exactly as before (no trailing gutter). Every row and the header must carry
  // one child per track, so a non-expanding row in an otherwise-reserved table fills its slot with an empty span.
  const anyClipped = Object.values(clippedByRow).some((list) => list && list.length > 0)
  const expanderReserved = detail.length > 0 || anyClipped
  const template = primary.map((column) => column.width ?? '1fr').join(' ') + (expanderReserved ? ' 32px' : '')

  return (
    <div style={{ overflowX: 'auto', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        {primary.map((column, i) => (
          <div key={i} style={{ ...typeScale.tableHeader, ...cellStyle, textAlign: column.align ?? 'left' }}>
            {column.header}
          </div>
        ))}
        {expanderReserved && <span />}
      </div>

      {rows.map((row, i) => {
        const key = rowKey(row, i)
        const isOpen = open === key
        const clipped = clippedByRow[key] ?? []
        // The expander appears when there is anything to reveal: a detail column, or a cell the row clipped.
        const showExpander = detail.length > 0 || clipped.length > 0

        const cells = primary.map((column, ci) => (
          <Cell key={ci} column={column} row={row} colIndex={ci} onMeasure={(col, info) => handleMeasure(key, col, info)} />
        ))
        // Fills the reserved expander track: the toggle where this row has content to reveal, an empty span elsewhere.
        const trailing = !expanderReserved ? null : showExpander ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            <button
              type="button"
              className="fct-expand"
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Hide details' : 'Show details'}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(isOpen ? null : key)
              }}
            >
              {isOpen ? '–' : '+'}
            </button>
          </div>
        ) : (
          <span />
        )
        const mainStyle: CSSProperties = { display: 'grid', gridTemplateColumns: template, alignItems: 'center', width: '100%', textAlign: 'left' }

        // The expansion gives back what the row hides: its detail columns plus any cell the ellipsis clipped.
        const items: Array<{ header: ReactNode; content: ReactNode }> = [
          ...detail.map((column) => ({ header: column.header, content: column.render(row) })),
          ...clipped.map((t) => ({ header: t.header, content: <span style={{ whiteSpace: 'normal' }}>{t.text}</span> })),
        ]

        const main = onRowClick ? (
          <button type="button" onClick={() => onRowClick(row)} style={{ ...mainStyle, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            {cells}
            {trailing}
          </button>
        ) : (
          <div style={mainStyle}>
            {cells}
            {trailing}
          </div>
        )

        return (
          // id per row so in-page anchors can target a specific row (e.g. the close calendar's blocked-by links).
          <div key={key} id={`fct-row-${key}`} className="fct-table-row" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, borderRadius: 0 }}>
            {main}
            {isOpen && items.length > 0 && (
              <div style={{ ...sunken, margin: '0 10px 12px', padding: '14px 18px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`, gap: '10px 24px', borderRadius: radius.md }}>
                {items.map((item, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ ...typeScale.tableHeader, fontFamily: fonts.mono }}>{item.header}</span>
                    <span style={{ fontSize: 13 }}>{item.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
