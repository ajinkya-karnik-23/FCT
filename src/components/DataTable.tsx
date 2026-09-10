import { useState } from 'react'
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

export function DataTable<T>({ columns, rows, rowKey, onRowClick, style }: DataTableProps<T>) {
  const primary = columns.filter((c) => !c.detail)
  const detail = columns.filter((c) => c.detail)
  const [open, setOpen] = useState<string | number | null>(null)
  const template = primary.map((column) => column.width ?? '1fr').join(' ') + (detail.length ? ' 32px' : '')

  return (
    <div style={{ overflowX: 'auto', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, borderBottom: `1px solid ${colors.borderSubtle}` }}>
        {primary.map((column, i) => (
          <div key={i} style={{ ...typeScale.tableHeader, ...cellStyle, textAlign: column.align ?? 'left' }}>
            {column.header}
          </div>
        ))}
        {detail.length > 0 && <span />}
      </div>

      {rows.map((row, i) => {
        const key = rowKey(row, i)
        const isOpen = open === key
        const cells = primary.map((column, ci) => (
          <div key={ci} style={{ ...cellStyle, textAlign: column.align ?? 'left' }}>
            {column.render(row)}
          </div>
        ))
        const expander = detail.length > 0 && (
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
        )
        const mainStyle: CSSProperties = { display: 'grid', gridTemplateColumns: template, alignItems: 'center', width: '100%', textAlign: 'left' }

        const main = onRowClick ? (
          <button type="button" onClick={() => onRowClick(row)} style={{ ...mainStyle, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            {cells}
            {expander}
          </button>
        ) : (
          <div style={mainStyle}>
            {cells}
            {expander}
          </div>
        )

        return (
          <div key={key} className="fct-table-row" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, borderRadius: 0 }}>
            {main}
            {isOpen && (
              <div style={{ ...sunken, margin: '0 10px 12px', padding: '14px 18px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(detail.length, 4)}, minmax(0, 1fr))`, gap: '10px 24px', borderRadius: radius.md }}>
                {detail.map((column, ci) => (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ ...typeScale.tableHeader, fontFamily: fonts.mono }}>{column.header}</span>
                    <span style={{ fontSize: 13 }}>{column.render(row)}</span>
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
