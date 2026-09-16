// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { getException, resetAgentLaneStore, resetWorklistActionStore } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render. §8.9 actions mutate the shared
// exception store, so restore the seeded state too.
beforeEach(() => {
  window.history.pushState(null, '', '/')
  resetWorklistActionStore()
  resetAgentLaneStore() // §15.1.1 — the demo cycle and overrides are session-local; each test starts before the agents run
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

function itemLinks(m: ReturnType<typeof main>) {
  return m.queryAllByRole('link').filter((l) => (l.textContent ?? '').startsWith('AR-'))
}

describe('O2C worklist (§18.3)', () => {
  it('opens on the needs-you view — all twelve rows, value-ranked against the entity-wide pool', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'O2C exceptions worklist' })).toBeTruthy()

    // Nothing is resolved and no agent lane hides a row, so the full sample shows in value order.
    const ids = itemLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AR-704001', 'AR-704002', 'AR-704003', 'AR-704004', 'AR-704005', 'AR-704006', 'AR-704007', 'AR-704008', 'AR-704009', 'AR-704010', 'AR-704011', 'AR-704012'])

    // §7.20 — sample against pool: unfiltered, the denominator is all six O2C causes pooled (284 / ₹18.8 cr). No agent
    // segment and no resolvable set — nothing in O2C clears same-day and no agents run on this process (§15.8).
    expect(m.getByText('12 of 284 shown · ₹9.60 cr of ₹18.8 cr · >30 days ₹7.96 cr')).toBeTruthy()

    // Every row reads why it never ran, and there is no cycle button to run one.
    expect(m.getAllByText('No live agent for this cause in this build')).toHaveLength(12)
    expect(m.queryByRole('button', { name: /Run the next cycle/ })).toBeNull()
    expect(m.queryByRole('button', { name: /resolvable today/ })).toBeNull()

    // The rail keeps the worklist entry active, like its P2P pair.
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('Worklist')
  })

  it('opens on the Collection stage cause set from the cockpit drill (§18.4) and narrows when a chip is deselected', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices?cause=credit-block,pricing-disputes')
    render(<App />)
    const m = main()

    // The Collection stage carries two causes at once; both chips stay active.
    expect(m.getByRole('button', { name: 'Credit block delays' }).className).toContain('fct-chip--active')
    expect(m.getByRole('button', { name: 'Pricing disputes' }).className).toContain('fct-chip--active')

    const ids = itemLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AR-704001', 'AR-704002', 'AR-704006', 'AR-704010', 'AR-704012'])

    // §7.20 — the pool is the sum of the two causes' pools (34 + 88 = 122 / ₹7.5 cr), not the entity-wide one.
    expect(m.getByText('5 of 122 shown · ₹4.67 cr of ₹7.5 cr · >30 days ₹4.37 cr')).toBeTruthy()

    // Deselecting one chip narrows the pool to the single cause (88 / ₹5.4 cr).
    fireEvent.click(m.getByRole('button', { name: 'Credit block delays' }))
    expect(window.location.search).toBe('?cause=pricing-disputes')
    const narrowed = itemLinks(m).map((r) => r.textContent ?? '')
    expect(narrowed).toEqual(['AR-704001', 'AR-704002', 'AR-704012'])
    expect(m.getByText('3 of 88 shown · ₹3.56 cr of ₹5.4 cr · >30 days ₹3.26 cr')).toBeTruthy()
  })

  it('drills from a register entry — the items traced to that root cause, with its pool as denominator (§17.10)', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices?rc=RC-019')
    render(<App />)
    const m = main()

    // The register's Items figure (40 / ₹2.4 cr) is the denominator; the sample holds the one traced item. The cause
    // chips hide while a register drill is open — two different scopes, one wins (§17.4).
    expect(m.getByText('1 of 40 shown · ₹1.84 cr of ₹2.4 cr · >30 days ₹1.84 cr')).toBeTruthy()
    const ids = itemLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AR-704001'])
    expect(m.queryByRole('button', { name: 'Pricing disputes' })).toBeNull()

    // §17.9 — the traced row carries its root cause line on the row itself.
    const firstRow = itemLinks(m)[0]
    expect((firstRow.closest('.fct-table-row')?.textContent ?? '')).toContain('root cause · Mid-quarter rate revisions not pushed to billing before the invoice run')
  })

  it('sorts by value, age and customer via the URL', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices')
    render(<App />)
    const m = main()

    // Value is the default: largest amount first.
    expect(itemLinks(m)[0].textContent).toBe('AR-704001')

    fireEvent.click(m.getByRole('button', { name: 'Age' }))
    expect(window.location.search).toBe('?sort=age')
    // Oldest visible first — AR-704001 at 148 days leads; the second row (AR-704006, 118 d) differs from value order.
    expect(itemLinks(m)[0].textContent).toBe('AR-704001')
    expect(itemLinks(m)[1].textContent).toBe('AR-704006')

    fireEvent.click(m.getByRole('button', { name: 'Customer' }))
    expect(window.location.search).toBe('?sort=customer')
    // A→Z — Amrit Distributors leads; within the customer, value order holds.
    const firstRow = itemLinks(m)[0]
    expect(firstRow.textContent).toBe('AR-704001')
    expect((firstRow.closest('.fct-table-row')?.textContent ?? '')).toContain('Amrit Distributors')

    fireEvent.click(m.getByRole('button', { name: 'Value' }))
    expect(window.location.search).toBe('?sort=value')
  })

  it('keeps the table shell for a cause with no matching rows, falling back to the full pool (§7.20)', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices?cause=not-a-cause')
    render(<App />)
    const m = main()

    expect(itemLinks(m)).toHaveLength(0)
    expect(m.getByText('No exceptions match this cause')).toBeTruthy()
    // An unknown key falls back to the entity-wide pool on both sides, like its P2P pair falls back to apBlocked.
    expect(m.getByText('0 of 284 shown · ₹0.00 cr of ₹18.8 cr · >30 days ₹0.00 cr')).toBeTruthy()
  })

  it('releases a single row — the evidence trail records it and the row reads RELEASED', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices')
    render(<App />)
    const m = main()

    // Value-desc default ⇒ AR-704001 leads; its Release button is first in DOM order.
    fireEvent.click(m.getAllByRole('button', { name: 'Release' })[0])
    expect(getException('AR-704001')!.status).toBe('released')
    expect(getException('AR-704001')!.evidence).toHaveLength(4)

    const firstRow = itemLinks(m)[0]
    expect((firstRow.closest('.fct-table-row')?.textContent ?? '')).toContain('RELEASED')
  })

  it('multi-selects rows and applies a bulk action', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices')
    render(<App />)
    const m = main()

    fireEvent.click(m.getByRole('checkbox', { name: 'Select AR-704001' }))
    fireEvent.click(m.getByRole('checkbox', { name: 'Select AR-704002' }))
    expect(m.getByText('2 SELECTED')).toBeTruthy()

    // The bulk bar renders before the table, so its Chase button is first in DOM order.
    fireEvent.click(m.getAllByRole('button', { name: 'Chase' })[0])

    expect(getException('AR-704001')!.status).toBe('chased')
    expect(getException('AR-704002')!.status).toBe('chased')
    expect(m.queryByText('2 SELECTED')).toBeNull() // selection clears after the bulk action
  })
})

describe('O2C exception detail (§18.3)', () => {
  it('renders the transaction, lifecycle and next action for AR-704001', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c/invoices/AR-704001')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Amrit Distributors' })).toBeTruthy()
    // §7.21 — the booking date is relative to today; derive it from the dataset, not a pinned literal.
    expect(m.getByText(`AR-704001 · PO-6102384 · booked ${getException('AR-704001')!.bookedOn}`)).toBeTruthy()

    // Transaction card — O2C rows name the cause's originating function and carry no P2P SLA line.
    expect(m.getByText('Jubilant Generics Ltd')).toBeTruthy()
    expect(m.getByText('₹1.84 cr')).toBeTruthy()
    expect(m.getByText('148 days')).toBeTruthy()
    expect(m.getByText('Pricing disputes')).toBeTruthy()
    expect(m.getByText('Nanjangud')).toBeTruthy()
    expect(m.getByText('A. Sethi')).toBeTruthy()
    expect(m.getByText('O2C tower — Commercial')).toBeTruthy()
    expect(m.queryByText(/Breached by/)).toBeNull()
    // Control significance reads bare for O2C rows (no payables-completeness suffix).
    expect(m.getByText('High')).toBeTruthy()

    // Lifecycle rows, oldest to the open one — O2C books an order and issues an invoice to the customer.
    for (const label of [
      'Order confirmed by customer',
      'Invoice issued to customer',
      'Customer short-paid against the revised contract rate',
      'Rate revision query raised with commercial',
      'Dispute escalated — pricing evidence requested',
    ]) {
      expect(m.getByText(label)).toBeTruthy()
    }

    // The open line carries the item's own escalation timer (148 d ⇒ one hour).
    expect(m.getByText('Awaiting rate confirmation from commercial — escalation due in 1 hour')).toBeTruthy()

    // §7.6 — attribution and the reason for it sit with the lifecycle, not in a separate panel.
    expect(m.getByText('Attribution — client')).toBeTruthy()
    expect(m.getByText('Contract rates are set by client commercial; the revision never reached billing')).toBeTruthy()

    // Next action card — O2C clears through a customer conversation; no "Chase GR" for receivables.
    expect(m.getByText(/clearing this item releases ₹1\.84 cr of blocked receivable/)).toBeTruthy()
    for (const chip of ['Assign owner', 'Log control exception']) {
      expect(m.getByRole('button', { name: chip })).toBeTruthy()
    }
    expect(m.queryByRole('button', { name: 'Chase GR' })).toBeNull()

    // Header actions — the back link follows the row's own process.
    expect(m.getByRole('link', { name: 'Why does this keep happening?' }).getAttribute('href')).toBe('/root-causes?cause=pricing-disputes')
    expect(m.getByRole('button', { name: 'Escalate to plant controller' })).toBeTruthy()
    expect(m.getByRole('link', { name: /Back to worklist/ }).getAttribute('href')).toBe('/entity/JGL/o2c/invoices')

    // §15.8 — no agent ran on this cause, so the decision record falls back to saying so.
    expect(m.getByText('No live agent for this cause in this build')).toBeTruthy()
  })
})
