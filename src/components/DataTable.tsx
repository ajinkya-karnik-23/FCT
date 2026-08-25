import type { CSSProperties, ReactNode } from 'react'
import { colors, spacing, typeScale } from '../theme/tokens'

export interface Column<T> {
  header: ReactNode
  width?: string
  align?: 'left' | 'right' | 'center'
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  style?: CSSProperties
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, style }: DataTableProps<T>) {
  const template = columns.map((column) => column.width ?? '1fr').join(' ')

  return (
    <div style={{ overflowX: 'auto', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: template }}>
        {columns.map((column, i) => (
          <div
            key={i}
            style={{
              ...typeScale.tableHeader,
              padding: spacing.tableCellPadding,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              textAlign: column.align ?? 'left',
            }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {rows.map((row, i) => {
        const cells = columns.map((column, ci) => (
          <div
            key={ci}
            style={{
              padding: spacing.tableCellPadding,
              textAlign: column.align ?? 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {column.render(row)}
          </div>
        ))

        const rowStyle: CSSProperties = {
          display: 'grid',
          gridTemplateColumns: template,
          width: '100%',
          textAlign: 'left',
        }

        if (onRowClick) {
          return (
            <button
              key={rowKey(row, i)}
              type="button"
              className="fct-table-row"
              onClick={() => onRowClick(row)}
              style={{
                ...rowStyle,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${colors.borderSubtle}`,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {cells}
            </button>
          )
        }

        return (
          <div key={rowKey(row, i)} className="fct-table-row" style={{ ...rowStyle, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            {cells}
          </div>
        )
      })}
    </div>
  )
}
