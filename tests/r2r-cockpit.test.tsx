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

describe('R2R cockpit (§16.2)', () => {
  it('renders the header KPIs and eight stage cards drilling to the R2R taxonomy', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Record to report, as one flow' })).toBeTruthy()
    expect(m.getByText(/level 2 — process · record to report/i)).toBeTruthy()
    // §16.8 — the breaks come from the reconciliation platform, not SAP alone.
    expect(m.getByText(/reconciliation platform/i)).toBeTruthy()

    // Header KPIs: JGL close % and open breaks (the latter ties to the rail count).
    expect(m.getByText('78%')).toBeTruthy()
    expect(m.getByText('18')).toBeTruthy()

    // §8.1 — the stage cards are open work in progress, not period volumes.
    expect(m.getByText('In flight at each stage')).toBeTruthy()
    expect(m.getByText('Open work in progress, not period volumes')).toBeTruthy()

    // Until Step 26's panels land, all eight stage cards drill to the taxonomy's largest node.
    const toReconciliation = m.getAllByRole('link').filter((l) => l.getAttribute('href') === '/entity/JGL/root-cause/r2r/reconciliation')
    expect(toReconciliation).toHaveLength(8)
    for (const name of ['Sub-ledger close', 'Accruals & provisions', 'Reconciliations', 'Intercompany', 'Adjusting journals', 'Trial balance', 'Reporting pack', 'Sign-off']) {
      expect(toReconciliation.some((l) => (l.textContent ?? '').includes(name))).toBe(true)
    }

    // Stage card contents, read from the Sub-ledger close card — Reporting pack rounds to the same 15%,
    // so a page-wide match would find two cards.
    const subCard = m.getByRole('link', { name: /Sub-ledger close/ })
    expect(within(subCard).getByText('96')).toBeTruthy()
    expect(within(subCard).getByText('15% exception')).toBeTruthy()

    // §8.2 — the drill anchor id follows the step code.
    expect(m.getByRole('link', { name: /Sub-ledger close/ }).id).toBe('fct-stage-SUB')
  })

  it('is reachable from the rail, directly after O2C cockpit, with its badge and active state', () => {
    render(<App />) // starts at '/' (group view)

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const items = within(rail).getAllByRole('link')
    const o2cIndex = items.findIndex((l) => (l.textContent ?? '').includes('O2C cockpit'))
    expect(o2cIndex).toBeGreaterThan(-1)
    const r2r = items[o2cIndex + 1]
    expect(r2r.textContent).toContain('R2R cockpit')
    expect(r2r.textContent).toContain('18')

    fireEvent.click(r2r)
    expect(window.location.pathname).toBe('/entity/JGL/r2r')
    expect(main().getByRole('heading', { level: 1, name: 'Record to report, as one flow' })).toBeTruthy()

    const bc = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    for (const crumb of ['Group', 'JGL', 'R2R']) {
      expect(bc).toContain(crumb)
    }
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('R2R cockpit')
  })

  it('is reachable from the command palette', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByPlaceholderText(/jump to an entity/i)
    fireEvent.change(input, { target: { value: 'r2r cockpit' } })

    const rows = within(dialog).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('R2R cockpit')
    expect(rows[0].textContent).toContain('18 open breaks')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/r2r')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
