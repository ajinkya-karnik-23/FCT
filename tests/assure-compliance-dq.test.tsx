// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { getCause, getEntity, listCompliance, listDataQuality } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset to "/" before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

const ENTITIES = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'] as const

function main() {
  return within(screen.getByRole('main'))
}

function breadcrumbText(): string {
  return screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
}

function activeNavLabel(): string | null {
  return document.querySelector('.fct-nav-item--active')?.textContent ?? null
}

describe('Compliance obligations (§7.26)', () => {
  it('JRP is the ONLY entity with an overdue item; every other compliance dimension is ≥88', () => {
    const overdue = listCompliance().filter((c) => c.status === 'overdue')
    expect(overdue.length).toBeGreaterThan(0)
    for (const o of overdue) expect(o.entityCode).toBe('JRP')

    // An overdue filing would cap the compliance dimension at 60 (§3.5), so no other entity may carry one.
    for (const code of ENTITIES) {
      if (code === 'JRP') continue
      expect(listCompliance(code).some((c) => c.status === 'overdue')).toBe(false)
      expect(getEntity(code)!.dimensions.compliance).toBeGreaterThanOrEqual(88)
    }
  })

  it('obligations match the entity jurisdiction — no Indian GST returns outside India', () => {
    for (const code of ENTITIES) {
      const e = getEntity(code)!
      const rows = listCompliance(code)
      if (e.geography !== 'India') {
        // JRP's overdue return is a Canada Revenue Agency filing, not GSTR-3B.
        for (const r of rows) expect(r.obligation.startsWith('GSTR')).toBe(false)
      } else {
        expect(rows.some((r) => r.obligation === 'GSTR-1')).toBe(true)
        expect(rows.some((r) => r.obligation === 'TDS deposit')).toBe(true)
      }
    }
  })

  it('value-at-risk figures tie to the §7.26 exposure table', () => {
    const find = (code: string, obligation: string) => listCompliance(code).find((c) => c.obligation === obligation)!
    expect(find('JGL', 'GSTR-2B reconciliation').valueAtRiskCr).toBe(1.8)
    expect(find('JBL', 'GSTR-2B reconciliation').valueAtRiskCr).toBe(0.9)
    expect(find('JGL', 'MSMED 45-day ageing').valueAtRiskCr).toBe(2.4)
    expect(find('JBL', 'MSMED 45-day ageing').valueAtRiskCr).toBe(1.1)
    expect(find('JPS', 'GST F5 return').valueAtRiskCr).toBe(0.4)
    expect(find('JCP', 'Sales & use tax').valueAtRiskCr).toBe(0.2)
    expect(find('JHS', 'GST/HST return').valueAtRiskCr).toBe(0.3)

    const jrp = find('JRP', 'GST/HST return')
    expect(jrp.status).toBe('overdue')
    expect(jrp.valueAtRiskCr).toBe(1.2)
  })

  it('operational failure counts carry their kind — IRN failures India-only, TIN mismatches on Form 1099 (§7.26)', () => {
    // E-invoice IRN is an Indian e-invoicing construct: only the two India entities can fail it.
    const jgl = listCompliance('JGL').find((c) => c.obligation === 'e-invoice IRN failures')!
    expect(jgl.failCount).toBe(14)
    expect(jgl.failureLabel).toBe('IRN failures')
    const jbl = listCompliance('JBL').find((c) => c.obligation === 'e-invoice IRN failures')!
    expect(jbl.failCount).toBe(8)
    expect(listCompliance().filter((c) => c.obligation === 'e-invoice IRN failures')).toHaveLength(2)

    // The US/Canada equivalent is a TIN mismatch on Form 1099: JCP 9 · JHS 6 · JRP 21.
    const tin = (code: string) => listCompliance(code).find((c) => c.obligation === 'Form 1099 filings')!
    expect(tin('JCP').failCount).toBe(9)
    expect(tin('JHS').failCount).toBe(6)
    expect(tin('JRP').failCount).toBe(21)
    for (const code of ['JCP', 'JHS', 'JRP']) expect(tin(code).failureLabel).toBe('TIN mismatches')
    // JRP's sales & use tax row no longer carries the count.
    expect(listCompliance('JRP').find((c) => c.obligation === 'Sales & use tax')!.failCount).toBeUndefined()
  })
})

describe('Data quality checks (§7.27)', () => {
  it('fail totals order strictly inversely with the data-quality dimension', () => {
    // JCP 94 cleanest → JRP 74 worst; as the score falls, failing records must rise.
    const byDq = [...ENTITIES].sort((a, b) => getEntity(b)!.dimensions.dataQuality - getEntity(a)!.dimensions.dataQuality)
    let prev = -1
    for (const code of byDq) {
      const total = listDataQuality(code).reduce((s, d) => s + d.failCount, 0)
      expect(total).toBeGreaterThan(prev)
      prev = total
    }
  })

  it('JGL anchors are pinned and the six checks span the four domains', () => {
    const jgl = listDataQuality('JGL')
    expect(jgl).toHaveLength(6)
    expect(new Set(jgl.map((d) => d.domain)).size).toBe(4)

    const pan = jgl.find((d) => d.domain === 'vendor' && d.check === 'Missing tax registration')!
    expect(pan).toMatchObject({ failCount: 14, totalCount: 812 })
    expect(jgl.find((d) => d.domain === 'interface')!.failCount).toBe(12)
  })

  it('the vendor-master failure is the §7.5 cause — share and value come from the dataset', () => {
    const cause = getCause('vendor-master')!
    expect(cause.sharePct).toBe(11)
    expect(cause.valueAtRisk).toBe(2.0)
  })
})

describe('Compliance screen (§7.26)', () => {
  it('renders all six entities with jurisdiction, status and exposure', () => {
    window.history.pushState(null, '', '/compliance')
    render(<App />)
    const m = screen.getByRole('main')
    expect(m.querySelector('h1')?.textContent).toBe('Compliance')

    // Multi-jurisdiction coverage is the selling point — every geography shows on its rows.
    const t = m.textContent ?? ''
    for (const j of ['India', 'Singapore', 'United States', 'US / Canada']) expect(t.includes(j)).toBe(true)

    // JRP is the only overdue row: exactly one OVERDUE tag, 19 filed + 7 due beside it.
    expect((t.match(/OVERDUE/g) ?? []).length).toBe(1)
    const tags = Array.from(m.querySelectorAll('.fct-status-tag')).map((el) => el.textContent?.trim())
    expect(tags.filter((x) => x === 'FILED').length).toBe(19)
    expect(tags.filter((x) => x === 'DUE').length).toBe(7)

    // The overdue → dimension → veto chain: three segments, all drilling to the JRP entity page.
    const jrpLinks = Array.from(m.querySelectorAll('a')).filter((a) => a.getAttribute('href') === '/entity/JRP')
    expect(jrpLinks.length).toBe(3)
  })

  it('route renders with its breadcrumb and active nav state', () => {
    window.history.pushState(null, '', '/compliance')
    render(<App />)
    const bc = breadcrumbText()
    expect(bc).toContain('Group')
    expect(bc).toContain('Compliance')
    expect(activeNavLabel()).toContain('Compliance')
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "compliance" also matches the buying-compliance agent; pick the screen row by its meta.
    fireEvent.change(input, { target: { value: 'compliance' } })
    const rows = within(p).getAllByRole('button')
    const complianceRows = rows.filter((r) => /open obligations/.test(r.textContent ?? ''))
    expect(complianceRows).toHaveLength(1)
    expect(complianceRows[0].textContent).toContain('Compliance')

    fireEvent.click(complianceRows[0])
    expect(window.location.pathname).toBe('/compliance')
  })
})

describe('Data quality screen (§7.27)', () => {
  it('renders the four domains with per-entity fail counts and interface health', () => {
    window.history.pushState(null, '', '/data-quality')
    render(<App />)
    const m = screen.getByRole('main')
    expect(m.querySelector('h1')?.textContent).toBe('Data quality')

    const t = m.textContent ?? ''
    for (const d of ['Vendor master', 'Customer master', 'General ledger', 'Interfaces']) expect(t.includes(d)).toBe(true)

    // JGL's pinned vendor PAN anchor renders as fail / total.
    expect(t.includes('14 / 812')).toBe(true)
    // Interface health: the two extremes' last successful runs render.
    expect(t.includes('31 Aug 2026, 04:00')).toBe(true)
    expect(t.includes('27 Aug 2026, 16:35')).toBe(true)
  })

  it('links the vendor-master failure to the root-cause view with §7.5 figures', () => {
    window.history.pushState(null, '', '/data-quality')
    render(<App />)
    const m = screen.getByRole('main')
    const sections = Array.from(m.querySelectorAll('section'))
    const panel = sections[sections.length - 1]

    expect(panel.querySelector('a')?.getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/vendor-master')
    // The §7.5 cause figures ride on the dataset, not literals: 11% of JGL's blocked AP, ₹2.0 cr.
    expect(panel.textContent).toContain('11%')
    expect(panel.textContent).toContain('₹2.0 cr')
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "data quality" matches only the screen item.
    fireEvent.change(input, { target: { value: 'data quality' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Data quality')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/data-quality')
  })
})
