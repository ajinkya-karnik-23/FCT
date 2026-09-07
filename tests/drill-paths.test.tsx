// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

// Step 5 drill paths (spec/08 Part D). Item 1 — the O2C cockpit → worklist →
// AP-104281 regression — already lives in p2p-worklist-exception.test.tsx; this
// file covers items 2–4: each O2C row opening its own cause, direct linkability
// of all twelve routes, and the no-cause entry points from a cold start and
// immediately after viewing an O2C cause.

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

function rail() {
  return screen.getByRole('navigation', { name: 'Primary' })
}

function crumbs() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' })
}

const P2P_CAUSES = [
  ['Missing GR', 'missing-gr'],
  ['PO price mismatch', 'po-price-mismatch'],
  ['Approval pending', 'approval-pending'],
  ['Vendor master', 'vendor-master'],
  ['Duplicate suspicion', 'duplicate-suspicion'],
  ['Tax mismatch', 'tax-mismatch'],
] as const

const O2C_CAUSES = [
  ['Pricing disputes', 'pricing-disputes'],
  ['Deductions & short-pay', 'deductions'],
  ['Billing errors', 'billing-errors'],
  ['Credit block delays', 'credit-block'],
  ['Cash application mismatch', 'cash-application'],
  ['Customer master', 'customer-master'],
] as const

function expectDefaultPair() {
  expect(window.location.pathname).toBe('/entity/JGL/root-cause/p2p/missing-gr')
  const m = main()
  expect(m.getByRole('heading', { level: 1, name: 'Why blocked invoices keep recurring' })).toBeTruthy()
  expect(m.getByText(/taxonomy — p2p/i)).toBeTruthy()
}

describe('Drill paths (spec/08 Part D)', () => {
  it('each of the six O2C taxonomy rows opens its own O2C cause with O2C copy', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c')
    render(<App />)

    for (const [name, key] of O2C_CAUSES) {
      fireEvent.click(main().getByRole('link', { name: new RegExp(name) }))
      expect(window.location.pathname).toBe(`/entity/JGL/root-cause/o2c/${key}`)

      const m = main()
      // Process-aware header, title and breadcrumb.
      expect(m.getByRole('heading', { level: 1, name: 'Why receivables keep ageing' })).toBeTruthy()
      expect(m.getByText(/taxonomy — o2c/i)).toBeTruthy()
      for (const crumb of ['Group', 'JGL', 'O2C']) {
        expect(crumbs().textContent).toContain(crumb)
      }
      expect(within(crumbs()).getByRole('link', { name: 'O2C' }).getAttribute('href')).toBe('/entity/JGL/o2c')

      // Renamed driver-card headers; the P2P ones are gone.
      expect(m.getByText(/by customer segment/i)).toBeTruthy()
      expect(m.getByText(/by driver/i)).toBeTruthy()
      expect(m.queryByText(/by plant/i)).toBeNull()
      expect(m.queryByText(/by vendor group/i)).toBeNull()

      // This row is the selected one and the primary panel reads from it.
      expect(m.getByRole('link', { name: new RegExp(name) }).className).toContain('fct-tax-row--selected')
      expect(m.getByText(new RegExp(`primary root cause — ${name.toLowerCase()}`, 'i'))).toBeTruthy()

      // Walk back to the cockpit for the next row.
      fireEvent.click(within(crumbs()).getByRole('link', { name: 'O2C' }))
      expect(window.location.pathname).toBe('/entity/JGL/o2c')
    }
  })

  it('every one of the twelve process-aware routes loads directly from its URL', () => {
    for (const proc of ['p2p', 'o2c'] as const) {
      const causes = proc === 'p2p' ? P2P_CAUSES : O2C_CAUSES
      for (const [name, key] of causes) {
        // Fresh tab: reset the URL and mount a fresh tree.
        window.history.pushState(null, '', `/entity/JGL/root-cause/${proc}/${key}`)
        render(<App />)

        const m = main()
        expect(m.getByRole('heading', { level: 1, name: proc === 'o2c' ? 'Why receivables keep ageing' : 'Why blocked invoices keep recurring' })).toBeTruthy()
        expect(m.getByText(new RegExp(`taxonomy — ${proc}`, 'i'))).toBeTruthy()
        expect(m.getByRole('link', { name: new RegExp(name) }).className).toContain('fct-tax-row--selected')
        expect(m.getByText(new RegExp(`primary root cause — ${name.toLowerCase()}`, 'i'))).toBeTruthy()

        cleanup()
      }
    }
  })

  it('cold start — rail Root cause, both tiles and Analyse → land on the default P2P pair', () => {
    render(<App />) // '/' group view

    fireEvent.click(within(rail()).getByRole('link', { name: /Root cause/ }))
    expectDefaultPair()

    // Entity home — walk back via the JGL crumb between drills.
    fireEvent.click(within(crumbs()).getByRole('link', { name: 'JGL' }))
    expect(window.location.pathname).toBe('/entity/JGL')

    for (const tile of [/18 aged breaks/, /12 high-risk JEs/]) {
      fireEvent.click(main().getByRole('link', { name: tile }))
      expectDefaultPair()
      fireEvent.click(within(crumbs()).getByRole('link', { name: 'JGL' }))
    }

    fireEvent.click(main().getByRole('link', { name: 'Analyse →' }))
    expectDefaultPair()
  })

  it('after viewing an O2C cause — the same entry points still land on the default P2P pair', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/o2c/pricing-disputes')
    render(<App />)
    expect(main().getByRole('heading', { level: 1, name: 'Why receivables keep ageing' })).toBeTruthy()

    // The rail item must not inherit the O2C cause just viewed.
    fireEvent.click(within(rail()).getByRole('link', { name: /Root cause/ }))
    expectDefaultPair()

    fireEvent.click(within(crumbs()).getByRole('link', { name: 'JGL' }))
    expect(window.location.pathname).toBe('/entity/JGL')

    fireEvent.click(main().getByRole('link', { name: /18 aged breaks/ }))
    expectDefaultPair()
    fireEvent.click(within(crumbs()).getByRole('link', { name: 'JGL' }))

    fireEvent.click(main().getByRole('link', { name: 'Analyse →' }))
    expectDefaultPair()
  })
})
