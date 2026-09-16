// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { causeEliminationTrend, currentPeriodEliminations, listCauses, listRootCauses, openExceptions, rootCauseCounts } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

describe('Root cause register (§17)', () => {
  it('renders the headline counts, every register row and the mechanism section', () => {
    window.history.pushState(null, '', '/root-causes')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Root causes' })).toBeTruthy()

    // §17 — the headline counts derive from the register; read each value inside its own stat. State words also
    // appear in the table's state column, so resolve label → value by finding the tile that carries both.
    const c = rootCauseCounts()
    for (const [label, value] of [
      ['IDENTIFIED', String(c.identified)],
      ['ELIMINATED', String(c.eliminated)],
      ['FIXED AT SOURCE', String(c['fixed-at-source'])],
      ['IN PROGRESS', String(c['in-progress'])],
    ] as const) {
      const tiles = m.getAllByText(label).map((el) => el.parentElement!)
      const stat = tiles.find((d) => within(d).queryAllByText(value).length > 0)
      expect(stat, `stat tile for ${label}`).toBeTruthy()
    }

    // The register lists every entry — one row per root cause, so each cause name appears exactly three times.
    // (The cause filter dropdown carries the same names as options; those are excluded.)
    expect(m.getByText(`${listRootCauses().length} root causes`)).toBeTruthy()
    for (const proc of ['p2p', 'o2c'] as const) {
      for (const cause of listCauses(proc)) {
        const rows = m.getAllByText(cause.name).filter((el) => el.tagName !== 'OPTION')
        expect(rows, cause.key).toHaveLength(3)
      }
    }

    // §7.30 — the mechanism section reads the same six points as the data layer, and its open-exception figure is the group's.
    const mech = m.getByText('The mechanism').closest('section')!
    const t = causeEliminationTrend()
    for (const v of t.closedSeries) {
      expect(within(mech).getAllByText(String(v)).length, String(v)).toBeGreaterThan(0)
    }
    expect(within(mech).getAllByText(openExceptions().toLocaleString('en-IN')).length).toBeGreaterThan(0)

    // The overclaim guard says which of the two lines it is showing.
    const p6 = currentPeriodEliminations()
    expect(
      within(mech).getByText(new RegExp(`The ${p6.count} root causes closed this period generated ${p6.generatedLastPeriod} exceptions`)),
    ).toBeTruthy()
  })

  it('an unknown ?cause= key falls back to the full register', () => {
    window.history.pushState(null, '', '/root-causes?cause=bogus')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Root causes' })).toBeTruthy()
    expect(m.getByText(`${listRootCauses().length} root causes`)).toBeTruthy()
  })

  it('drills from a row — Items to the traced worklist items, the agent cell to its record (§17.4)', () => {
    window.history.pushState(null, '', '/root-causes')
    render(<App />)
    const m = main()

    // §17.4 — the figure is what is open behind the entry now: eliminated entries read 0 with no drill; fixed-at-source
    // reads its residue endpoint; identified/in-progress carry their count. Every non-eliminated row drills to the worklist
    // filtered to that root cause, P2P and O2C alike.
    for (const entry of listRootCauses()) {
      const row = m.getByText(entry.why).closest('.fct-table-row')!
      if (entry.state === 'eliminated') {
        expect(within(row).getByText('0'), entry.id).toBeTruthy()
        expect(within(row).queryByRole('link', { name: '0' }), entry.id).toBeNull()
      } else {
        const figure = entry.state === 'fixed-at-source' && entry.residueTrend ? entry.residueTrend[entry.residueTrend.length - 1] : entry.affectedItems
        const itemsLink = within(row).getByRole('link', { name: String(figure) })
        expect(itemsLink.getAttribute('href'), entry.id).toMatch(new RegExp(`^/entity/[A-Z]{3}/(p2p|o2c)/invoices\\?rc=${entry.id}$`))
      }
    }

    // The agent cell is a drill to the agent's record; §17.8 — structural changes carry no agent and say so.
    // Owner & agent is a detail column, so each row must be expanded first (one open at a time).
    const withAgent = listRootCauses().filter((e) => e.agentId)
    expect(withAgent.length).toBeGreaterThan(0)
    for (const entry of withAgent) {
      const row = m.getByText(entry.why).closest('.fct-table-row')!
      fireEvent.click(within(row).getByRole('button', { name: 'Show details' }))
      expect(within(row).getByRole('link', { name: /^agent · / }).getAttribute('href'), entry.id).toBe(`/agents/${entry.agentId}`)
    }
    const noAgent = listRootCauses().filter((e) => !e.agentId)
    expect(noAgent.length).toBeGreaterThan(0)
    for (const entry of noAgent) {
      const row = m.getByText(entry.why).closest('.fct-table-row')!
      fireEvent.click(within(row).getByRole('button', { name: 'Show details' }))
      expect(within(row).getByText('no agent can act'), entry.id).toBeTruthy()
      expect(within(row).queryByRole('link', { name: /^agent · / }), entry.id).toBeNull()
    }

    // §17.4 — the third leg of the triangulation is on the row itself: arrivals stop when the inflow stops. (Fix & timeline is a detail column.)
    for (const entry of listRootCauses().filter((e) => e.state === 'eliminated')) {
      const row = m.getByText(entry.why).closest('.fct-table-row')!
      fireEvent.click(within(row).getByRole('button', { name: 'Show details' }))
      expect(within(row).getByText(`${entry.newArrivals} new this period`), entry.id).toBeTruthy()
    }
  })
})

describe('Working capital (spec/06)', () => {
  it('renders the KPIs, both ageing cards and the cash opportunity table', () => {
    window.history.pushState(null, '', '/entity/JGL/working-capital')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Cash locked in exceptions' })).toBeTruthy()

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
      ['Missing GR', '₹6.4 cr'],
      ['PO price mismatch', '₹4.1 cr'],
      ['Approval pending', '₹3.3 cr'],
      ['Vendor master', '₹2.0 cr'],
      ['Duplicate / tax', '₹2.8 cr'],
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

    // §8.2 — the intercompany netting row carries the drill anchor id from the consequence strip.
    expect(document.getElementById('fct-ic-netting')?.textContent).toContain('Clear intercompany netting with Ingrevia')

    // Rows are informational — nothing on this page is clickable.
    expect(m.queryAllByRole('link')).toHaveLength(0)
    expect(m.queryAllByRole('button')).toHaveLength(0)
  })
})
