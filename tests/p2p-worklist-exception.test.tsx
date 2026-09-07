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

function worklistLinks(m: ReturnType<typeof main>) {
  return m.queryAllByRole('link').filter((l) => (l.textContent ?? '').startsWith('AP-'))
}

describe('P2P cockpit (spec/05)', () => {
  it('renders the seven stage cards and the three analysis cards', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Procure to pay' })).toBeTruthy()

    // §8.1 — the stage cards are open work in progress, not period volumes.
    expect(m.getByText('In flight at each stage')).toBeTruthy()
    expect(m.getByText('Open work in progress, not period volumes')).toBeTruthy()

    // Six stage cards plus the "Open blocked invoices" button-link target the worklist; §15.7 — the Purchase order card drills to the commitments watch instead (open POs by delivery date).
    const toWorklist = m.getAllByRole('link').filter((l) => l.getAttribute('href') === '/entity/JGL/p2p/invoices')
    expect(toWorklist).toHaveLength(7)
    for (const name of ['Requisition', 'Goods receipt', 'Invoice', 'Three-way match', 'Approval', 'Payment']) {
      expect(toWorklist.some((l) => (l.textContent ?? '').includes(name))).toBe(true)
    }
    const toCommitments = m.getAllByRole('link').filter((l) => l.getAttribute('href') === '/entity/JGL/p2p/commitments')
    expect(toCommitments).toHaveLength(1)
    expect((toCommitments[0].textContent ?? '').includes('Purchase order')).toBe(true)

    // Stage card contents: thousands-separated volume and the exception rate (Goods receipt stage).
    expect(m.getByText('349')).toBeTruthy()
    expect(m.getByText('19% exception')).toBeTruthy()

    // Blocked invoices by ageing — bucket labels and values.
    expect(m.getByText(/blocked invoices by ageing/i)).toBeTruthy()
    for (const label of ['0-15 d', '16-30 d', '31-60 d', '61-90 d', '> 90 d']) {
      expect(m.getByText(label)).toBeTruthy()
    }
    expect(m.getByText('₹5.9 cr')).toBeTruthy()

    // Top causes — each row drills to its root-cause page.
    expect(m.getByRole('link', { name: /Missing GR/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /PO price mismatch/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/po-price-mismatch')
    expect(m.getByText('34%')).toBeTruthy()

    // Service & control values.
    expect(m.getByText(/service & control/i)).toBeTruthy()
    expect(m.getByText('93.1%')).toBeTruthy()
    expect(m.getByText('27')).toBeTruthy()
    expect(m.getByText('₹0.9 cr')).toBeTruthy()

    // The pinned button opens the worklist.
    expect(m.getByRole('link', { name: /Open 327 blocked invoices/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')
  })
})

describe('Worklist (spec/05)', () => {
  it('opens on the needs-you view — what the agents could not close, with their output leading the header', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Blocked invoices worklist' })).toBeTruthy()

    // §15.7 — the agents have already run when the page opens; the default view is every state but resolved.
    const ids = worklistLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AP-104281', 'AP-104501', 'AP-104522', 'AP-104570', 'AP-104588', 'AP-104611'])

    // §15.1.1 — the header leads with what the agents have already done; the cycle times are group-level. Disposition, not release: no write-back.
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 6 of 327 shown · ₹5.53 cr of ₹18.6 cr · >30 days ₹3.45 cr · 2 of 38 resolvable in this view')).toBeTruthy()

    // The per-row lanes read what each agent is doing or did; the vendor bank detail change never automates (§15.8).
    // The escalation timer is each item's own — older items escalate sooner, so no two working lanes read alike.
    expect(m.getByText('working · escalates in 6 h')).toBeTruthy() // AP-104281, 41 d
    expect(m.getByText('working · escalates in 29 h')).toBeTruthy() // AP-104501, 18 d
    expect(m.getByText('working · escalates in 20 h')).toBeTruthy() // AP-104588, 27 d
    expect(m.getByText('escalated to you — no contract price precedent for the vendor')).toBeTruthy()
    expect(m.getByText('Vendor bank detail change — never automated (§15.8)')).toBeTruthy()
    expect(m.getByText('No live agent for this cause in this build')).toBeTruthy()
  })

  it('filters by cause in the URL and recomputes the aggregates over the filtered rows', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    fireEvent.click(m.getByRole('button', { name: 'Missing GR' }))
    expect(window.location.search).toBe('?cause=missing-gr')

    // A drill from a financial figure shows everything behind that figure — all four missing-GR rows, the two agents resolved included (the needs-you default applies to navigation, not to figure drills).
    const ids = worklistLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AP-104281', 'AP-104402', 'AP-104458', 'AP-104588'])

    // Aggregates recompute over the filtered rows; one of the four (AP-104588) is resolvable today. §7.20 — denominators follow the filter: the pool is the cause's own 111 / ₹6.4 cr, not the entity-wide one.
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 4 of 111 shown · ₹5.47 cr of ₹6.4 cr · >30 days ₹5.00 cr · 1 of 38 resolvable in this view')).toBeTruthy()

    // "All" clears the filter and restores the needs-you aggregates — the cause chip; the agent-lane group carries its own 'All'.
    fireEvent.click(m.getAllByRole('button', { name: 'All' })[0])
    expect(window.location.search).toBe('')
    expect(worklistLinks(m)).toHaveLength(6)
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 6 of 327 shown · ₹5.53 cr of ₹18.6 cr · >30 days ₹3.45 cr · 2 of 38 resolvable in this view')).toBeTruthy()
  })

  it('sorts by value, age and vendor via the URL', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    // Value is the default: largest amount first.
    expect((worklistLinks(m)[0].textContent ?? '').startsWith('AP-104281')).toBe(true)

    fireEvent.click(m.getByRole('button', { name: 'Age' }))
    expect(window.location.search).toBe('?sort=age')
    // Oldest visible first — AP-104281 at 41 days leads; the second row (AP-104522, 33 d) differs from value order.
    expect((worklistLinks(m)[0].textContent ?? '').startsWith('AP-104281')).toBe(true)
    expect((worklistLinks(m)[1].textContent ?? '').startsWith('AP-104522')).toBe(true)

    fireEvent.click(m.getByRole('button', { name: 'Vendor' }))
    expect(window.location.search).toBe('?sort=vendor')
    // A→Z — Ganga Freight Movers leads. The link carries the invoice id; the vendor sits in its row.
    const firstRow = worklistLinks(m)[0]
    expect(firstRow.textContent).toBe('AP-104588')
    expect((firstRow.closest('.fct-table-row')?.textContent ?? '')).toContain('Ganga Freight Movers')

    fireEvent.click(m.getByRole('button', { name: 'Value' }))
    expect((worklistLinks(m)[0].textContent ?? '').startsWith('AP-104281')).toBe(true)
  })

  it('keeps the table shell for a cause with no matching rows', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices?cause=not-a-cause')
    render(<App />)
    const m = main()

    expect(worklistLinks(m)).toHaveLength(0)
    expect(m.getByText('No exceptions match this cause')).toBeTruthy()
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 0 of 327 shown · ₹0.00 cr of ₹18.6 cr · >30 days ₹0.00 cr · 0 of 38 resolvable in this view')).toBeTruthy()
  })

  it('releases a single row — the evidence trail records it and the row reads RELEASED', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    // Value-desc default ⇒ AP-104281 leads; its Release button is first in DOM order.
    fireEvent.click(m.getAllByRole('button', { name: 'Release' })[0])
    expect(getException('AP-104281')!.status).toBe('released')
    expect(getException('AP-104281')!.evidence).toHaveLength(4)

    const firstRow = worklistLinks(m)[0]
    expect((firstRow.closest('.fct-table-row')?.textContent ?? '')).toContain('RELEASED')
  })

  it('multi-selects rows and applies a bulk action', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    fireEvent.click(m.getByRole('checkbox', { name: 'Select AP-104281' }))
    fireEvent.click(m.getByRole('checkbox', { name: 'Select AP-104501' }))
    expect(m.getByText('2 SELECTED')).toBeTruthy()

    // The bulk bar renders before the table, so its Chase button is first in DOM order.
    fireEvent.click(m.getAllByRole('button', { name: 'Chase' })[0])

    expect(getException('AP-104281')!.status).toBe('chased')
    expect(getException('AP-104501')!.status).toBe('chased')
    expect(m.queryByText('2 SELECTED')).toBeNull() // selection clears after the bulk action
  })

  it('filters to the low-effort releasable set and offers a bulk release', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    fireEvent.click(m.getByRole('button', { name: '38 resolvable today' }))
    expect(window.location.search).toBe('?resolvable=1')

    // The two resolvable-today rows the agents could not close remain, value-descending (§7.19); the header explains why 2 of 38.
    const ids = worklistLinks(m).map((r) => r.textContent ?? '')
    expect(ids).toEqual(['AP-104570', 'AP-104588'])
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 2 of 327 shown · ₹1.01 cr of ₹18.6 cr · >30 days ₹0.00 cr · 2 of 38 resolvable in this view')).toBeTruthy()
    expect(m.getByText('2 low-effort items · ₹1.01 cr')).toBeTruthy()

    fireEvent.click(m.getByRole('button', { name: 'Release all 2' }))
    for (const id of ['AP-104570', 'AP-104588']) {
      expect(getException(id)!.status).toBe('released')
    }
    expect(m.queryByRole('button', { name: 'Release all 2' })).toBeNull() // nothing left to release
  })

  it('shows every row under the "All" agent lane, including what the agents already resolved', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices?lane=all')
    render(<App />)
    const m = main()

    // All twelve rows; the six the agents closed read "agent resolved" with a why link to their decision record.
    expect(worklistLinks(m)).toHaveLength(12)
    expect(m.getAllByText('agent resolved')).toHaveLength(6)
    expect(m.getAllByRole('link', { name: 'why →' })).toHaveLength(6)

    // The header aggregates recompute over the full list; the agent segments are unchanged.
    expect(m.getByText('327 blocked · 241 resolved by agents · 86 need you · agents last ran 06:42 · next cycle 07:00 · 12 of 327 shown · ₹12.77 cr of ₹18.6 cr · >30 days ₹8.99 cr · 4 of 38 resolvable in this view')).toBeTruthy()
  })

  it('runs the next cycle once — the header drops 86 to 79 and the working lanes resolve', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    const m = main()

    expect(m.getByRole('button', { name: 'Run the next cycle (demo)' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(m.getByRole('button', { name: 'Run the next cycle (demo)' }))

    // §15.1.1 — one-shot per session; the need-you count drops and the working lanes read resolved.
    expect(m.getByRole('button', { name: 'Run the next cycle (demo)' }).hasAttribute('disabled')).toBe(true)
    expect(m.getByText('327 blocked · 248 resolved by agents · 79 need you · agents last ran 06:42 · next cycle 07:00 · 3 of 327 shown · ₹1.54 cr of ₹18.6 cr · >30 days ₹0.61 cr · 1 of 38 resolvable in this view')).toBeTruthy()

    // The three working rows cleared; what remains needs a human — one escalation and the two never-automated rows.
    expect(worklistLinks(m)).toHaveLength(3)
    // No working lanes remain, so no escalation timer of any value can be on screen.
    expect(m.queryAllByText(/escalates in \d+ h/)).toHaveLength(0)
    expect(m.getByText('escalated to you — no contract price precedent for the vendor')).toBeTruthy()
  })
})

describe('Exception detail (spec/05)', () => {
  it('renders the transaction, lifecycle and next action for AP-104281', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices/AP-104281')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Suraksha Chemicals Pvt Ltd' })).toBeTruthy()
    // §7.21 — the booking date is relative to today; derive it from the dataset, not a pinned literal.
    expect(m.getByText(`AP-104281 · PO-4471902 · booked ${getException('AP-104281')!.bookedOn}`)).toBeTruthy()

    // Transaction card.
    expect(m.getByText('Jubilant Generics Ltd')).toBeTruthy()
    expect(m.getByText('₹2.84 cr')).toBeTruthy()
    expect(m.getByText('41 days')).toBeTruthy()
    expect(m.getByText('Missing GR')).toBeTruthy()
    expect(m.getByText('Nanjangud')).toBeTruthy()
    expect(m.getByText('P. Nair')).toBeTruthy()
    expect(m.getByText('Breached by 26 days')).toBeTruthy()
    expect(m.getByText(/High — payables completeness/)).toBeTruthy()

    // Lifecycle rows, oldest to the open one.
    for (const label of [
      'PO released to vendor',
      'Invoice received via vendor portal',
      'Three-way match failed — no goods receipt',
      'Query raised with Nanjangud stores',
      'Vendor follow-up, no GR posted',
      'Awaiting GR — escalation due in 6 hours',
    ]) {
      expect(m.getByText(label)).toBeTruthy()
    }

    // §7.6 — attribution and the reason for it sit with the lifecycle, not in a separate panel.
    expect(m.getByText('Attribution — client')).toBeTruthy()
    expect(m.getByText('Goods receipts are posted by client plant stores — the block sits with the client')).toBeTruthy()

    // Next action card.
    expect(m.getByText(/clears ₹2\.84 cr of payment block/)).toBeTruthy()
    for (const chip of ['Chase GR', 'Assign owner', 'Log control exception']) {
      expect(m.getByRole('button', { name: chip })).toBeTruthy()
    }

    // Header actions.
    expect(m.getByRole('link', { name: 'Why does this keep happening?' }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('button', { name: 'Escalate to plant controller' })).toBeTruthy()
    expect(m.getByRole('link', { name: /Back to worklist/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')
  })

  it('never inherits the last-viewed cause — the button targets the exception\'s own reason (spec/08 Part D)', () => {
    // Arrive via the O2C cockpit so an O2C cause is the most recently viewed one.
    window.history.pushState(null, '', '/entity/JGL/o2c')
    render(<App />)
    const m = main()
    fireEvent.click(m.getByRole('link', { name: /Pricing disputes/ }))
    expect(window.location.pathname).toBe('/entity/JGL/root-cause/o2c/pricing-disputes')

    // Back to the P2P worklist, open invoice AP-104281 (blocking reason 'Missing GR').
    const rail = screen.getByRole('navigation', { name: 'Primary' })
    fireEvent.click(within(rail).getByRole('link', { name: /Worklist/ }))
    expect(window.location.pathname).toBe('/entity/JGL/p2p/invoices')
    fireEvent.click(m.getByRole('link', { name: /AP-104281/ }))

    // The button lands on Missing GR / P2P — not the O2C cause seen moments earlier.
    fireEvent.click(m.getByRole('link', { name: 'Why does this keep happening?' }))
    expect(window.location.pathname).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('heading', { level: 1, name: 'Why blocked invoices keep recurring' })).toBeTruthy()
    expect(m.getByText(/taxonomy — p2p/i)).toBeTruthy()
  })
})
