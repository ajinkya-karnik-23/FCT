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

describe('O2C cockpit (spec/08 Part B)', () => {
  it('renders the header KPIs, seven stage cards and the three analysis cards', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Revenue to cash, as one flow' })).toBeTruthy()
    expect(m.getByText(/level 2 — process · order to cash/i)).toBeTruthy()

    // Header KPIs.
    for (const text of ['62 d', '₹20.6 cr', '₹3.1 cr']) {
      expect(m.getByText(text)).toBeTruthy()
    }

    // §8.1 — the stage cards are open work in progress, not period volumes.
    expect(m.getByText('In flight at each stage')).toBeTruthy()
    expect(m.getByText('Open work in progress, not period volumes')).toBeTruthy()

    // Seven stage cards plus the pinned button all target working capital.
    const toWorkingCapital = m.getAllByRole('link').filter((l) => l.getAttribute('href') === '/entity/JGL/working-capital')
    expect(toWorkingCapital).toHaveLength(8)
    for (const name of ['Order', 'Credit check', 'Delivery', 'Billing', 'Invoice dispatch', 'Collection', 'Cash application']) {
      expect(toWorkingCapital.some((l) => (l.textContent ?? '').includes(name))).toBe(true)
    }

    // Stage card contents: thousands-separated volume and the exception rate (Collection stage).
    expect(m.getByText('1,183')).toBeTruthy()
    expect(m.getByText('24% exception')).toBeTruthy()

    // §8.2 — the Collection stage card carries the drill anchor id from the consequence strip.
    expect(m.getByRole('link', { name: /Collection/ }).id).toBe('fct-stage-COL')

    // Receivables by ageing — bucket labels and values.
    expect(m.getByText(/receivables by ageing/i)).toBeTruthy()
    for (const label of ['0-30 d', '31-60 d', '61-90 d', '91-180 d', '> 180 d']) {
      expect(m.getByText(label)).toBeTruthy()
    }
    expect(m.getByText('₹24.1 cr')).toBeTruthy()

    // O2C taxonomy — six rows drill to their O2C cause on the process-aware route (Part D).
    for (const [name, key] of [
      ['Pricing disputes', 'pricing-disputes'],
      ['Deductions & short-pay', 'deductions'],
      ['Billing errors', 'billing-errors'],
      ['Credit block delays', 'credit-block'],
      ['Cash application mismatch', 'cash-application'],
      ['Customer master', 'customer-master'],
    ] as const) {
      expect(m.getByRole('link', { name: new RegExp(name, 'i') }).getAttribute('href')).toBe(`/entity/JGL/root-cause/o2c/${key}`)
    }
    expect(m.getByText('31%')).toBeTruthy()

    // Service & control values.
    expect(m.getByText(/service & control/i)).toBeTruthy()
    for (const value of ['96.4%', '34', '18', '19']) {
      expect(m.getByText(value)).toBeTruthy()
    }

    // The pinned button opens working capital.
    expect(m.getByRole('link', { name: /Open 41 overdue customers/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
  })

  it('is reachable from the rail, directly after P2P cockpit, with its badge and active state', () => {
    render(<App />) // starts at '/' (group view)

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const items = within(rail).getAllByRole('link')
    const p2pIndex = items.findIndex((l) => (l.textContent ?? '').includes('P2P cockpit'))
    expect(p2pIndex).toBeGreaterThan(-1)
    const o2c = items[p2pIndex + 1]
    expect(o2c.textContent).toContain('O2C cockpit')
    expect(o2c.textContent).toContain('284')

    fireEvent.click(o2c)
    expect(window.location.pathname).toBe('/entity/JGL/o2c')
    expect(main().getByRole('heading', { level: 1, name: 'Revenue to cash, as one flow' })).toBeTruthy()

    const bc = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    for (const crumb of ['Group', 'JGL', 'O2C']) {
      expect(bc).toContain(crumb)
    }
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('O2C cockpit')
  })

  it('is reachable from the command palette', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByPlaceholderText(/jump to an entity/i)
    fireEvent.change(input, { target: { value: 'o2c cockpit' } })

    const rows = within(dialog).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('O2C cockpit')
    expect(rows[0].textContent).toContain('process')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/o2c')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
