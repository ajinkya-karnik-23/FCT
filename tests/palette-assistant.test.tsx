// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../src/App'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

const PALETTE_INPUT = 'Jump to an entity, process, exception or vendor'

function palette() {
  return screen.getByRole('dialog', { name: 'Command palette' })
}

describe('Command palette (spec/07)', () => {
  it('opens on Ctrl+K and filters by case-insensitive substring of label + kind', () => {
    render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = palette()
    const input = within(p).getByPlaceholderText(PALETTE_INPUT)

    // Vendor name matches the exception label.
    fireEvent.change(input, { target: { value: 'suraksha' } })
    let rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('AP-104281 · Suraksha Chemicals Pvt Ltd')
    expect(rows[0].textContent).toContain('₹2.84 cr · 41 d')

    // The kind column is part of the match target; uppercase query still matches.
    // Both taxonomies are covered — twelve entries, capped at nine (spec/08 Part D).
    fireEvent.change(input, { target: { value: 'ROOT CAUSE' } })
    rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(9)
    expect(rows[0].textContent).toContain('Missing GR · P2P')

    // A cause name matches its own entry in either taxonomy.
    fireEvent.change(input, { target: { value: 'pricing disputes' } })
    rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Pricing disputes · O2C')
  })

  it('shows the unfiltered list capped at nine rows, in spec order', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true }) // ⌘K path
    const p = palette()
    const rows = within(p).getAllByRole('button')

    expect(rows).toHaveLength(9)
    // Six entities first, with their health scores...
    expect(rows[0].textContent).toContain('Jubilant Generics Ltd')
    expect(rows[0].textContent).toContain('health 74')
    expect(rows[5].textContent).toContain('Jubilant Life Sciences NV')
    // ...then exceptions in dataset order; root causes and screens are past the cap.
    expect(rows[6].textContent).toContain('AP-104281')
    expect(rows[8].textContent).toContain('AP-104355')
  })

  it('navigates on Enter to the first match and closes', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = within(palette()).getByPlaceholderText(PALETTE_INPUT)

    fireEvent.change(input, { target: { value: 'working capital' } })
    expect(within(palette()).getAllByRole('button')).toHaveLength(1)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(window.location.pathname).toBe('/entity/JGL/working-capital')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens from the rail search button and closes on Escape or scrim click', () => {
    render(<App />)
    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const searchBtn = within(rail).getByRole('button', { name: /Search everything/ })

    fireEvent.click(searchBtn)
    expect(screen.queryByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    // A click inside the panel does not close; a scrim click does.
    fireEvent.click(searchBtn)
    const p = palette()
    fireEvent.click(p)
    expect(screen.queryByRole('dialog')).toBeTruthy()
    fireEvent.click(document.querySelector('.fct-palette-scrim') as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lists all twelve root causes, six per process, each opening its own pair (spec/08 Part D)', () => {
    render(<App />)

    const cases: Array<[string, string, string]> = [
      ['missing gr', 'Missing GR · P2P', '/entity/JGL/root-cause/p2p/missing-gr'],
      ['po price mismatch', 'PO price mismatch · P2P', '/entity/JGL/root-cause/p2p/po-price-mismatch'],
      ['approval pending', 'Approval pending · P2P', '/entity/JGL/root-cause/p2p/approval-pending'],
      ['vendor master', 'Vendor master · P2P', '/entity/JGL/root-cause/p2p/vendor-master'],
      ['duplicate suspicion', 'Duplicate suspicion · P2P', '/entity/JGL/root-cause/p2p/duplicate-suspicion'],
      ['tax mismatch', 'Tax mismatch · P2P', '/entity/JGL/root-cause/p2p/tax-mismatch'],
      ['pricing disputes', 'Pricing disputes · O2C', '/entity/JGL/root-cause/o2c/pricing-disputes'],
      ['short-pay', 'Deductions & short-pay · O2C', '/entity/JGL/root-cause/o2c/deductions'],
      ['billing errors', 'Billing errors · O2C', '/entity/JGL/root-cause/o2c/billing-errors'],
      ['credit block delays', 'Credit block delays · O2C', '/entity/JGL/root-cause/o2c/credit-block'],
      ['cash application mismatch', 'Cash application mismatch · O2C', '/entity/JGL/root-cause/o2c/cash-application'],
      ['customer master', 'Customer master · O2C', '/entity/JGL/root-cause/o2c/customer-master'],
    ]

    for (const [query, label, path] of cases) {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      const input = within(palette()).getByPlaceholderText(PALETTE_INPUT)
      fireEvent.change(input, { target: { value: query } })

      // Each cause name matches exactly one entry — its own process.
      const rows = within(palette()).getAllByRole('button')
      expect(rows).toHaveLength(1)
      expect(rows[0].textContent).toContain(label)

      fireEvent.keyDown(input, { key: 'Enter' })
      expect(window.location.pathname).toBe(path)
      expect(screen.queryByRole('dialog')).toBeNull()
    }
  })
})

describe('AI drawer (spec/07)', () => {
  it('asks from the entity home, streams the answer and commits it with follow-up chips', async () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask why this entity is amber' }))

    // The drawer opens beside the content; the question lands as a user bubble.
    expect(screen.getByText(/cockpit intelligence/i)).toBeTruthy()
    expect(screen.getByText('Why is this entity showing amber?')).toBeTruthy()

    // The canned answer streams in and commits once complete — cursor drops, chips appear.
    await screen.findByText(/controllership issue rather than a throughput issue/, undefined, { timeout: 8000 })
    await waitFor(() => expect(screen.queryByText('▋')).toBeNull(), { timeout: 2000 })
    expect(screen.getByRole('button', { name: 'Open the worklist' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show root cause' })).toBeTruthy()

    // Follow-up chips navigate.
    fireEvent.click(screen.getByRole('button', { name: 'Open the worklist' }))
    expect(window.location.pathname).toBe('/entity/JGL/p2p/invoices')

    // The no-cause chip resolves to the default pair — p2p plus its first cause (spec/08 Part D).
    fireEvent.click(screen.getByRole('button', { name: 'Show root cause' }))
    expect(window.location.pathname).toBe('/entity/JGL/root-cause/p2p/missing-gr')
  }, 15000)

  it('top bar toggles the drawer open and closed without starting a conversation', () => {
    render(<App />)
    const header = screen.getByRole('banner')
    const toggle = within(header).getByRole('button', { name: /Ask the cockpit/ })

    fireEvent.click(toggle)
    expect(screen.getByText(/cockpit intelligence/i)).toBeTruthy()
    expect(screen.getByText(/grounded on the finance semantic model/i)).toBeTruthy()
    for (const q of ['Why is AP exposure building?', 'Which plants and vendors drive it?', 'What should I do first?']) {
      expect(screen.getByRole('button', { name: q })).toBeTruthy()
    }

    fireEvent.click(toggle)
    expect(screen.queryByText(/cockpit intelligence/i)).toBeNull()
  })

  it('preset buttons ask their canned question and stream to completion', async () => {
    render(<App />)
    const header = screen.getByRole('banner')
    fireEvent.click(within(header).getByRole('button', { name: /Ask the cockpit/ }))

    fireEvent.click(screen.getByRole('button', { name: 'What should I do first?' }))
    // The question text now appears twice: the preset button and the user bubble.
    expect(screen.getAllByText('What should I do first?')).toHaveLength(2)

    await screen.findByText(/blocking close sign-off/, undefined, { timeout: 8000 })
    await waitFor(() => expect(screen.queryByText('▋')).toBeNull(), { timeout: 2000 })
  }, 15000)

  it('falls back to the group answer for an unrecognised question', async () => {
    render(<App />)
    const header = screen.getByRole('banner')
    fireEvent.click(within(header).getByRole('button', { name: /Ask the cockpit/ }))

    const input = screen.getByPlaceholderText('Ask about any entity, process or exception')
    fireEvent.change(input, { target: { value: 'How is the group doing?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Match the true tail of the fallback answer, then wait for the commit (cursor drop).
    await screen.findByText(/concentrated in Jubilant Generics and Jubilant Life Sciences\./, undefined, { timeout: 8000 })
    await waitFor(() => expect(screen.queryByText('▋')).toBeNull(), { timeout: 2000 })
  }, 15000)
})
