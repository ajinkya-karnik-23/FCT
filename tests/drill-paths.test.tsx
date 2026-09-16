// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { listRootCauses } from '../src/api'

// Step 5 drill paths (spec/08 Part D) — §17 rewired: every root-cause entry point lands on the group
// register, pre-filtered to its cause via ?cause=. This file covers the O2C cockpit cards, direct
// linkability of all twelve deep links, and the no-cause entry points from a cold start and
// immediately after viewing a filtered section.

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

// The register's row count label doubles as the filter proof: a cause section shows exactly its own rows.
function expectRegisterRowLabel(m: ReturnType<typeof main>, n: number) {
  expect(m.getByText(`${n} root causes`)).toBeTruthy()
}

describe('Drill paths (spec/08 Part D, §17)', () => {
  it('every O2C analysis card carries its cause as a register deep link', () => {
    window.history.pushState(null, '', '/entity/JGL/o2c')
    render(<App />)

    for (const [name, key] of O2C_CAUSES) {
      expect(main().getByRole('link', { name: new RegExp(name) }).getAttribute('href')).toBe(`/root-causes?cause=${key}`)
    }
  })

  it('every one of the twelve deep links loads its cause section directly from its URL', () => {
    for (const [proc, causes] of [['p2p', P2P_CAUSES], ['o2c', O2C_CAUSES]] as const) {
      for (const [, key] of causes) {
        // Fresh tab: reset the URL and mount a fresh tree.
        window.history.pushState(null, '', `/root-causes?cause=${key}`)
        render(<App />)

        const m = main()
        expect(m.getByRole('heading', { level: 1, name: 'Root causes' })).toBeTruthy()
        // §17.6 — three root causes per cause; the section shows exactly its own.
        expectRegisterRowLabel(m, 3)
        const selects = Array.from(screen.getByRole('main').querySelectorAll('.fct-input')) as HTMLSelectElement[]
        expect(selects[0].value).toBe(proc === 'p2p' ? 'P2P' : 'O2C')
        expect(selects[1].value).toBe(key)

        cleanup()
      }
    }
  })

  it('cold start — rail Root causes, both tiles and Analyse → land on the unfiltered register', () => {
    render(<App />) // '/' group view

    fireEvent.click(within(rail()).getByRole('link', { name: /Root causes/ }))
    expect(window.location.pathname).toBe('/root-causes')
    expect(window.location.search).toBe('')
    expectRegisterRowLabel(main(), listRootCauses().length)

    // Entity home — fresh tab, then the two R2R tiles and the Analyse link.
    cleanup()
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)

    for (const tile of [/18 aged breaks/, /12 high-risk JEs/]) {
      fireEvent.click(main().getByRole('link', { name: tile }))
      expect(window.location.pathname).toBe('/root-causes')
      expect(window.location.search).toBe('')
      cleanup()
      window.history.pushState(null, '', '/entity/JGL')
      render(<App />)
    }

    fireEvent.click(main().getByRole('link', { name: 'Analyse →' }))
    expect(window.location.pathname).toBe('/root-causes')
    expect(window.location.search).toBe('')
  })

  it('after viewing a cause section — the same entry points still land on the unfiltered register', () => {
    window.history.pushState(null, '', '/root-causes?cause=pricing-disputes')
    render(<App />)
    expectRegisterRowLabel(main(), 3)

    // The rail item must not inherit the cause just viewed.
    fireEvent.click(within(rail()).getByRole('link', { name: /Root causes/ }))
    expect(window.location.pathname).toBe('/root-causes')
    expect(window.location.search).toBe('')
    expectRegisterRowLabel(main(), listRootCauses().length)

    // Entity home entry points carry no cause either.
    cleanup()
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    fireEvent.click(main().getByRole('link', { name: /18 aged breaks/ }))
    expect(window.location.pathname).toBe('/root-causes')
    expect(window.location.search).toBe('')
  })
})
