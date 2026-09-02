// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { getEntity, listCostCentres, listCounterparties, listExceptions, listPlants, listStages } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

const ENTITIES = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'] as const
// §7.24 — ties are asserted in integer paise so floating-point noise cannot mask a drift.
const paise = (cr: number) => Math.round(cr * 100)

function main() {
  return within(screen.getByRole('main'))
}

describe('Counterparty reconciliation ties (§7.24)', () => {
  it('Σ vendor blocked = worklist shown value, per entity; JGL pinned at ₹12.77 cr', () => {
    for (const code of ENTITIES) {
      const vendors = listCounterparties(code, 'vendor')
      const rows = listExceptions(code)
      expect(paise(vendors.reduce((s, v) => s + v.blockedCr, 0))).toBe(rows.reduce((s, x) => s + paise(x.amount), 0))
    }
    expect(paise(listCounterparties('JGL', 'vendor').reduce((s, v) => s + v.blockedCr, 0))).toBe(1277)
  })

  it('Σ plant blocked = entity blocked AP (the pool), per entity; JGL follows the §7.24 overall split', () => {
    for (const code of ENTITIES) {
      const plants = listPlants(code)
      expect(paise(plants.reduce((s, p) => s + p.blockedCr, 0))).toBe(paise(getEntity(code)!.metrics.apBlocked.current))
    }
    // §7.24 — Nanjangud 43 / Roorkee 29 / Ambernath 18 / Noida 10 of the ₹18.6 cr pool (integer-paise allocation).
    expect(listPlants('JGL').map((p) => paise(p.blockedCr))).toEqual([800, 539, 335, 186])
  })

  it('Σ cost centre committed = PO stage in-flight value, per entity; each PO list sums to its centre', () => {
    for (const code of ENTITIES) {
      const centres = listCostCentres(code)
      const poStage = listStages('p2p', code).find((s) => s.step === 'PO')!
      expect(paise(centres.reduce((s, c) => s + c.committedSpendCr, 0))).toBe(paise(poStage.inFlightValue))
      for (const c of centres) {
        expect(paise(c.openPos.reduce((s, p) => s + p.valueCr, 0))).toBe(paise(c.committedSpendCr))
      }
    }
  })

  it('Σ customer exposure ≥ AR over 90 days, per entity', () => {
    for (const code of ENTITIES) {
      const customers = listCounterparties(code, 'customer')
      const exposurePaise = paise(customers.reduce((s, c) => s + (c.exposureCr ?? 0), 0))
      expect(exposurePaise >= paise(getEntity(code)!.metrics.arOver90.current)).toBe(true)
    }
  })

  it('Σ vendor open commitments = PO stage in-flight value, per entity', () => {
    for (const code of ENTITIES) {
      const poStage = listStages('p2p', code).find((s) => s.step === 'PO')!
      expect(paise(listCounterparties(code, 'vendor').reduce((s, v) => s + v.openCommitmentsCr, 0))).toBe(paise(poStage.inFlightValue))
    }
  })

  it('JBL and JRP each carry a centre over budget on committed spend, not booked (§7.28)', () => {
    const jbl = listCostCentres('JBL').find((c) => c.id === 'jbl-lab-operations')!
    expect(jbl.bookedSpendCr).toBeLessThanOrEqual(jbl.budgetCr) // the budget looks fine on booked spend alone
    expect(paise(jbl.bookedSpendCr + jbl.committedSpendCr)).toBeGreaterThan(paise(jbl.budgetCr))
    const jrp = listCostCentres('JRP').find((c) => c.id === 'jrp-regulatory')!
    expect(jrp.bookedSpendCr).toBeLessThanOrEqual(jrp.budgetCr)
    expect(paise(jrp.bookedSpendCr + jrp.committedSpendCr)).toBeGreaterThan(paise(jrp.budgetCr))
  })
})

describe('Counterparty pages (§6)', () => {
  it('vendor page — every open item carries its owner and reason; blocked value is the worklist slice', () => {
    window.history.pushState(null, '', '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd')
    render(<App />)
    const el = screen.getByRole('main') as HTMLElement
    const m = within(el)
    expect(m.getByRole('heading', { level: 1 }).textContent).toBe('Suraksha Chemicals Pvt Ltd')
    expect(m.getByText('1 open items · ₹2.8 cr blocked')).toBeTruthy()
    expect(m.getByText('₹2.8 cr · 1')).toBeTruthy() // BLOCKED INVOICES metric — value and count together
    expect(m.getByText('Blocked value by age')).toBeTruthy()
    const text = el.textContent ?? ''
    for (const s of ['AP-104281', '₹2.84 cr', '41 d', 'Missing GR', 'Nanjangud', 'P. Nair']) expect(text).toContain(s)
  })

  it('customer page — exposure, credit block status and the release path', () => {
    window.history.pushState(null, '', '/entity/JGL/customer/jgl-deccan')
    render(<App />)
    const el = screen.getByRole('main') as HTMLElement
    const m = within(el)
    expect(m.getByRole('heading', { level: 1 }).textContent).toBe('Deccan Pharma Retail')
    expect(m.getByText('CREDIT BLOCKED')).toBeTruthy()
    expect(m.getByText('₹4.8 cr')).toBeTruthy() // EXPOSURE
    expect(m.getByText('₹0.0 cr')).toBeTruthy() // DISPUTES & DEDUCTIONS — a credit block is not a dispute
    const text = el.textContent ?? ''
    expect(text).toContain('Clean payment record; orders held on a stale credit limit awaiting manual review')
    expect(text).toContain('Release credit block on Deccan Pharma Retail — Entity controller')
  })

  it('cost centre page — booked and committed against budget, with the open POs driving the gap', () => {
    window.history.pushState(null, '', '/entity/JGL/cost-centre/jgl-nanjangud-operations')
    render(<App />)
    const el = screen.getByRole('main') as HTMLElement
    const m = within(el)
    expect(m.getByRole('heading', { level: 1 }).textContent).toBe('Nanjangud Operations')
    expect(m.getByText('-₹0.3 cr')).toBeTruthy() // REMAINING AFTER COMMITMENTS — over budget once commitments land
    const text = el.textContent ?? ''
    for (const s of ['₹71.0 cr', '₹47.5 cr', '₹23.8 cr', 'PO-47902', '₹8.6 cr', 'PO-48115', '₹7.4 cr', 'PO-48260', '₹4.8 cr', 'PO-48391', '₹3.0 cr']) {
      expect(text).toContain(s)
    }
    expect(text).toContain('Over budget once commitments land — booked plus committed exceeds the plan by ₹0.3 cr.')
  })

  it('cost centre page — JBL Lab Operations overruns on open POs, not booked spend (§7.28)', () => {
    window.history.pushState(null, '', '/entity/JBL/cost-centre/jbl-lab-operations')
    render(<App />)
    const el = screen.getByRole('main') as HTMLElement
    const m = within(el)
    expect(m.getByRole('heading', { level: 1 }).textContent).toBe('Lab Operations')
    expect(m.getByText('-₹1.0 cr')).toBeTruthy() // REMAINING AFTER COMMITMENTS — over budget once commitments land
    const text = el.textContent ?? ''
    for (const s of ['₹60.0 cr', '₹44.2 cr', '₹16.8 cr']) {
      expect(text).toContain(s)
    }
    expect(text).toContain('Over budget once commitments land — booked plus committed exceeds the plan by ₹1.0 cr.')
  })

  it('plant page — blocked value, GR compliance and ageing by cause; rows drill to their vendor', () => {
    window.history.pushState(null, '', '/entity/JGL/plant/jgl-nanjangud')
    render(<App />)
    const el = screen.getByRole('main') as HTMLElement
    const m = within(el)
    expect(m.getByRole('heading', { level: 1 }).textContent).toBe('Nanjangud')
    expect(m.getByText('3 open items · ₹8.0 cr blocked')).toBeTruthy()
    expect(m.getByText('92.8%')).toBeTruthy() // GR COMPLIANCE — worst at the plant carrying most of the block
    const text = el.textContent ?? ''
    for (const s of ['₹4.12 cr', 'Missing GR', '₹0.74 cr', 'Duplicate suspicion']) expect(text).toContain(s)
    // §7.20 — the shown rows are a sample; where they do not cover the plant figure, say so.
    expect(text).toContain('Shown rows total ₹4.86 cr; the plant figure covers the full blocked population.')
    const vendorLink = m.getByRole('link', { name: 'Suraksha Chemicals Pvt Ltd' })
    expect(vendorLink.getAttribute('href')).toBe('/entity/JGL/vendor/suraksha-chemicals-pvt-ltd')
  })

  it('breadcrumb carries the counterparty back to its process screen (§9.1)', () => {
    window.history.pushState(null, '', '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd')
    render(<App />)
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(crumbs.textContent).toContain('Suraksha Chemicals Pvt Ltd')
    expect(within(crumbs).getByRole('link', { name: 'P2P' }).getAttribute('href')).toBe('/entity/JGL/p2p')
  })

  it('palette finds a counterparty and drills to its page', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p')
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // The plant and its cost centre are both one row away.
    fireEvent.change(input, { target: { value: 'nanjangud' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('PLANT')
    expect(rows[1].textContent).toContain('COST CENTRE')

    fireEvent.click(rows[0])
    expect(window.location.pathname).toBe('/entity/JGL/plant/jgl-nanjangud')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(main().getByRole('heading', { level: 1 }).textContent).toBe('Nanjangud')
  })
})
