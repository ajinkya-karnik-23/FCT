// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

describe('Root cause (spec/06)', () => {
  it('renders the taxonomy with the selected row and the missing-GR analysis', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/missing-gr')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Why blocked invoices keep recurring' })).toBeTruthy()
    expect(m.getByText(/level 5 — root cause/i)).toBeTruthy()
    expect(m.getByText(/taxonomy — p2p/i)).toBeTruthy()

    // Six taxonomy rows, each linking to its own cause key.
    const links = m.getAllByRole('link')
    expect(links).toHaveLength(6)
    for (const [name, key] of [
      ['Missing GR', 'missing-gr'],
      ['PO price mismatch', 'po-price-mismatch'],
      ['Approval pending', 'approval-pending'],
      ['Vendor master', 'vendor-master'],
      ['Duplicate suspicion', 'duplicate-suspicion'],
      ['Tax mismatch', 'tax-mismatch'],
    ] as const) {
      expect(m.getByRole('link', { name: new RegExp(name) }).getAttribute('href')).toBe(`/entity/JGL/root-cause/${key}`)
    }

    // The selected row is the one in the URL; the others are not.
    expect(m.getByRole('link', { name: /Missing GR/ }).className).toContain('fct-tax-row--selected')
    expect(m.getByRole('link', { name: /PO price mismatch/ }).className).not.toContain('--selected')

    // Primary root cause panel — narrative and the four metrics from the CauseNode.
    expect(m.getByText(/primary root cause — missing gr/i)).toBeTruthy()
    expect(m.getByText(/goods receipts are posted after invoice receipt/)).toBeTruthy()
    for (const [label, value] of [
      ['VALUE AT RISK', '₹6.3 cr'],
      ['AVG DELAY', '8.4 days'],
      ['RECURRENCE', '5th month'],
      ['CONCENTRATION', '11 vendors'],
    ] as const) {
      expect(m.getByText(label)).toBeTruthy()
      expect(m.getByText(value)).toBeTruthy()
    }

    // By plant and by vendor group driver rows.
    for (const label of ['Nanjangud', 'Roorkee', 'Ambernath', 'Noida']) expect(m.getByText(label)).toBeTruthy()
    for (const pct of ['43%', '29%', '10%']) expect(m.getByText(pct)).toBeTruthy()
    for (const label of ['Consignment chemicals', 'Packaging', 'Logistics', 'Other']) expect(m.getByText(label)).toBeTruthy()
    for (const pct of ['38%', '27%', '21%', '14%']) expect(m.getByText(pct)).toBeTruthy()

    // Recommended intervention — the cause's three actions.
    expect(m.getByText(/recommended intervention/i)).toBeTruthy()
    for (const action of [
      'GR compliance alert for the top 11 vendor/plant pairs',
      'Auto-escalate to plant controller after 48 hours',
      'Move consignment vendors to GR-based invoicing',
    ]) {
      expect(m.getByText(action)).toBeTruthy()
    }
  })

  it('switches the analysis when a taxonomy row is clicked', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/missing-gr')
    render(<App />)
    const m = main()

    fireEvent.click(m.getByRole('link', { name: /PO price mismatch/ }))
    expect(window.location.pathname).toBe('/entity/JGL/root-cause/po-price-mismatch')

    // The right-hand side now reads from the po-price-mismatch CauseNode.
    expect(m.getByText(/primary root cause — po price mismatch/i)).toBeTruthy()
    expect(m.getByText(/contract escalations were signed but not loaded into the purchasing info record/)).toBeTruthy()
    for (const value of ['₹4.1 cr', '6.1 days', '3rd month', '4 contracts']) {
      expect(m.getByText(value)).toBeTruthy()
    }

    // Driver rows follow the new cause; the selection marker moves with it.
    expect(m.getByText('Solvents')).toBeTruthy()
    for (const pct of ['41%', '20%', '28%', '16%']) expect(m.getByText(pct)).toBeTruthy()
    expect(m.getByRole('link', { name: /PO price mismatch/ }).className).toContain('fct-tax-row--selected')
    expect(m.getByRole('link', { name: /Missing GR/ }).className).not.toContain('--selected')
  })

  it('falls back for a cause key outside the fixed taxonomy', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/not-a-cause')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Unknown cause not-a-cause' })).toBeTruthy()
    // The fallback lists the six taxonomy causes as links.
    expect(m.getAllByRole('link')).toHaveLength(6)
  })
})

describe('Working capital (spec/06)', () => {
  it('renders the KPIs, both ageing cards and the cash opportunity table', () => {
    window.history.pushState(null, '', '/entity/JGL/working-capital')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Cash locked in exceptions' })).toBeTruthy()
    expect(m.getByText(/working capital/i)).toBeTruthy()

    // Header KPIs — DSO amber, DPO plain, releasable green.
    for (const [label, value] of [
      ['DSO', '62 d'],
      ['DPO', '48 d'],
      ['RELEASABLE', '₹4.2 cr'],
    ] as const) {
      expect(m.getByText(label)).toBeTruthy()
    }
    expect(m.getByText('62 d')).toBeTruthy()
    expect(m.getByText('48 d')).toBeTruthy()
    // ₹4.2 cr appears twice: the KPI and the first cash opportunity row.
    expect(m.getAllByText('₹4.2 cr')).toHaveLength(2)

    // Receivables ageing — five buckets with values from the dataset.
    expect(m.getByText(/receivables ageing/i)).toBeTruthy()
    for (const [label, value] of [
      ['0-30 d', '₹24.1 cr'],
      ['31-60 d', '₹11.6 cr'],
      ['61-90 d', '₹8.2 cr'],
      ['91-180 d', '₹7.4 cr'],
      ['> 180 d', '₹5.0 cr'],
    ] as const) {
      expect(m.getByText(label)).toBeTruthy()
      expect(m.getByText(value)).toBeTruthy()
    }

    // Payables blocked by reason — five rows from the dataset.
    expect(m.getByText(/payables blocked by reason/i)).toBeTruthy()
    for (const [label, value] of [
      ['Missing GR', '₹6.3 cr'],
      ['PO price mismatch', '₹4.1 cr'],
      ['Approval pending', '₹3.2 cr'],
      ['Vendor master', '₹1.8 cr'],
      ['Duplicate / tax', '₹1.6 cr'],
    ] as const) {
      expect(m.getByText(label)).toBeTruthy()
      expect(m.getByText(value)).toBeTruthy()
    }

    // Cash opportunity table — four rows with value, items, effort and owner.
    expect(m.getByText(/cash opportunity/i)).toBeTruthy()
    for (const name of [
      'Release invoices where GR posted this week',
      'Apply matched receipts to open AR',
      'Settle pricing disputes under ₹10 lakh',
      'Clear intercompany netting with Ingrevia',
    ]) {
      expect(m.getByText(name)).toBeTruthy()
    }
    for (const value of ['₹2.1 cr', '₹1.4 cr', '₹3.6 cr']) expect(m.getByText(value)).toBeTruthy()
    for (const owner of ['P2P tower', 'Cash application', 'Collections', 'R2R tower']) {
      expect(m.getByText(owner)).toBeTruthy()
    }

    // Rows are informational — nothing on this page is clickable.
    expect(m.queryAllByRole('link')).toHaveLength(0)
    expect(m.queryAllByRole('button')).toHaveLength(0)
  })
})
